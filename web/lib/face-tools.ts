"use client";

// ブラウザ内の画像解析ユーティリティ（外部送信しない）

export type SkinMetrics = {
  brightness: number;
  contrast: number;
  redness: number;
  shineRatio: number;
};

export function analyzeSkin(canvas: HTMLCanvasElement): SkinMetrics {
  const ctx = canvas.getContext("2d")!;
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let sum = 0;
  let sumSq = 0;
  let red = 0;
  let shine = 0;
  const n = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    sum += lum;
    sumSq += lum * lum;
    red += r - (g + b) / 2;
    if (lum > 235) shine += 1;
  }
  const mean = sum / n;
  const variance = sumSq / n - mean * mean;
  return {
    brightness: Math.round(mean),
    contrast: Math.round(Math.sqrt(Math.max(0, variance))),
    redness: Math.round(red / n),
    shineRatio: shine / n,
  };
}

export type FaceBox = { x: number; y: number; width: number; height: number };

// Chrome系の FaceDetector があれば使う。なければ中央推定。
export async function detectFace(canvas: HTMLCanvasElement): Promise<FaceBox> {
  type FD = new (opts?: { fastMode?: boolean }) => {
    detect: (i: CanvasImageSource) => Promise<Array<{ boundingBox: DOMRectReadOnly }>>;
  };
  const FaceDetectorCtor = (globalThis as { FaceDetector?: FD }).FaceDetector;
  if (FaceDetectorCtor) {
    try {
      const detector = new FaceDetectorCtor({ fastMode: true });
      const faces = await detector.detect(canvas);
      if (faces[0]) {
        const b = faces[0].boundingBox;
        return { x: b.x, y: b.y, width: b.width, height: b.height };
      }
    } catch {
      // フォールバックへ
    }
  }
  const w = canvas.width * 0.5;
  const h = canvas.height * 0.62;
  return { x: (canvas.width - w) / 2, y: canvas.height * 0.12, width: w, height: h };
}

export function fileToCanvas(file: File, maxSize = 900): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      resolve(canvas);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// 将来顔シミュレーション: 年数に応じて彩度低下・コントラスト・シワ風ノイズ・頬の影を加える
export function renderFutureFace(
  src: HTMLCanvasElement,
  face: FaceBox,
  years: 0 | 5 | 10 | 20,
  cared: boolean,
): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = src.width;
  out.height = src.height;
  const ctx = out.getContext("2d")!;
  ctx.drawImage(src, 0, 0);
  if (years === 0) return out;

  const k = cared ? years * 0.45 : years; // ケアで進行を約半分に
  const img = ctx.getImageData(0, 0, out.width, out.height);
  const d = img.data;
  const desat = Math.min(0.35, 0.012 * k);
  const darken = Math.min(20, 0.8 * k);
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    d[i] = r + (gray - r) * desat - darken * 0.4;
    d[i + 1] = g + (gray - g) * desat - darken * 0.5;
    d[i + 2] = b + (gray - b) * desat - darken * 0.3;
  }
  ctx.putImageData(img, 0, 0);

  // 頬の影（たるみ表現）
  const cx = face.x + face.width / 2;
  const grad = ctx.createRadialGradient(cx, face.y + face.height * 0.72, face.width * 0.1, cx, face.y + face.height * 0.75, face.width * 0.55);
  grad.addColorStop(0, `rgba(60,40,40,0)`);
  grad.addColorStop(1, `rgba(60,40,40,${Math.min(0.22, 0.011 * k)})`);
  ctx.fillStyle = grad;
  ctx.fillRect(face.x - face.width * 0.2, face.y, face.width * 1.4, face.height * 1.2);

  // ほうれい線・目尻のライン
  ctx.strokeStyle = `rgba(70,45,45,${Math.min(0.3, 0.014 * k)})`;
  ctx.lineWidth = Math.max(1, face.width * 0.008);
  const mouthY = face.y + face.height * 0.74;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + side * face.width * 0.16, face.y + face.height * 0.58);
    ctx.quadraticCurveTo(cx + side * face.width * 0.26, mouthY - 8, cx + side * face.width * 0.2, mouthY + 6);
    ctx.stroke();
    ctx.beginPath();
    const eyeY = face.y + face.height * 0.4;
    ctx.moveTo(cx + side * face.width * 0.34, eyeY);
    ctx.quadraticCurveTo(cx + side * face.width * 0.42, eyeY + 4, cx + side * face.width * 0.45, eyeY + 12);
    ctx.stroke();
  }

  // 粒状ノイズ
  const noise = ctx.getImageData(face.x, face.y, Math.min(face.width, out.width - face.x), Math.min(face.height, out.height - face.y));
  const nd = noise.data;
  const amp = Math.min(14, 0.7 * k);
  for (let i = 0; i < nd.length; i += 4) {
    const v = (Math.random() - 0.5) * amp;
    nd[i] += v;
    nd[i + 1] += v;
    nd[i + 2] += v;
  }
  ctx.putImageData(noise, face.x, face.y);
  return out;
}
