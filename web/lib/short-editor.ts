/**
 * ブラウザ内でショート動画を自動編集する。
 * MOV / MP4 / WebM など video 要素で再生できる素材を 9:16 にクロップし、
 * テロップ・HUD を重ねて MediaRecorder で書き出す（Workers 上で FFmpeg 不要）。
 */

export type AutoEditOptions = {
  title?: string;
  maxSeconds?: number;
  startSec?: number;
  width?: number;
  height?: number;
  typoScale?: number;
  overlay?: "heavy" | "light";
};

function pickMime(): string {
  const cands = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  for (const m of cands) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) return m;
  }
  return "video/webm";
}

function loadVideo(file: File): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    const url = URL.createObjectURL(file);
    video.onloadedmetadata = () => resolve(video);
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("この動画を再生できません（コーデック非対応の可能性があります）"));
    };
    video.src = url;
  });
}

/** 中央寄せで 9:16 にカバー描画 */
function drawCover(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  w: number,
  h: number,
) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const scale = Math.max(w / vw, h / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  const dx = (w - dw) / 2;
  const dy = (h - dh) / 2;
  ctx.drawImage(video, dx, dy, dw, dh);
}

function drawOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  title: string,
  t: number,
  opts?: { typoScale?: number; overlay?: "heavy" | "light" },
) {
  const typoScale = opts?.typoScale ?? 1;
  const light = opts?.overlay === "light";

  // 上下グラデ
  const g1 = ctx.createLinearGradient(0, 0, 0, h * 0.22);
  g1.addColorStop(0, light ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.55)");
  g1.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, w, h * 0.22);

  const g2 = ctx.createLinearGradient(0, h * 0.72, 0, h);
  g2.addColorStop(0, "rgba(0,0,0,0)");
  g2.addColorStop(1, light ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0.65)");
  ctx.fillStyle = g2;
  ctx.fillRect(0, h * 0.72, w, h * 0.28);

  // 四隅マーク
  if (!light) {
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 4;
    const m = 36;
    const L = 70;
    for (const [cx, cy, dx, dy] of [
      [m, m, 1, 1],
      [w - m, m, -1, 1],
      [m, h - m, 1, -1],
      [w - m, h - m, -1, -1],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + dx * L, cy);
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx, cy + dy * L);
      ctx.stroke();
    }
  }

  const m = 36;
  ctx.fillStyle = "#ff5e7e";
  ctx.font = `600 ${Math.round(w * 0.035)}px sans-serif`;
  ctx.fillText("REC ● FIRSTLOOK", m + 16, m + 48);

  // タイトル（フェードイン）
  const alpha = Math.min(1, Math.max(0, (t - 0.3) / 0.5));
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${Math.round(w * 0.09 * typoScale)}px sans-serif`;
  ctx.textAlign = "center";
  const lines = title.split("\n").slice(0, 2);
  lines.forEach((line, i) => {
    ctx.fillText(line, w / 2, h * 0.78 + i * Math.round(w * 0.1 * typoScale));
  });
  ctx.textAlign = "left";
  ctx.globalAlpha = 1;

  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.font = `500 ${Math.round(w * 0.028)}px sans-serif`;
  ctx.fillText("9:16 | AI AUTO-EDIT", m + 16, h - m - 20);
}

/**
 * MOV/MP4 等から AI 風ショート（9:16・テロップ付き）を生成して Blob を返す。
 */
export async function autoEditShortVideo(
  file: File,
  opts: AutoEditOptions = {},
): Promise<{ blob: Blob; mime: string; duration: number }> {
  const width = opts.width ?? 720;
  const height = opts.height ?? 1280;
  const maxSeconds = opts.maxSeconds ?? 15;
  const startSec = Math.max(0, opts.startSec ?? 0);
  const title = (opts.title ?? "FIRSTLOOK").slice(0, 40);
  const typoScale = opts.typoScale ?? 1;
  const overlay = opts.overlay ?? "heavy";

  const video = await loadVideo(file);
  await video.play().catch(() => undefined);
  video.pause();

  // 開始位置へシーク
  await new Promise<void>((resolve) => {
    const onSeek = () => {
      video.removeEventListener("seeked", onSeek);
      resolve();
    };
    video.addEventListener("seeked", onSeek);
    video.currentTime = Math.min(startSec, Math.max(0, (video.duration || startSec) - 0.1));
    // seeked が来ない環境向け
    setTimeout(resolve, 800);
  });

  const remain = Math.max(0.5, (video.duration || maxSeconds) - video.currentTime);
  const duration = Math.min(remain, maxSeconds);
  if (!Number.isFinite(duration) || duration < 0.5) {
    throw new Error("動画の長さを取得できませんでした");
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const stream = canvas.captureStream(30);

  // 音声があればミックス
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioCtx = new AudioCtx();
    const source = audioCtx.createMediaElementSource(video);
    const dest = audioCtx.createMediaStreamDestination();
    source.connect(dest);
    source.connect(audioCtx.destination);
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  } catch {
    // 無音でも続行
  }

  const mime = pickMime();
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const done = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime }));
    recorder.onerror = () => reject(new Error("録画に失敗しました"));
  });

  recorder.start(200);
  await video.play();

  await new Promise<void>((resolve) => {
    const start = performance.now();
    const tick = () => {
      const elapsed = (performance.now() - start) / 1000;
      if (elapsed >= duration || video.ended) {
        resolve();
        return;
      }
      drawCover(ctx, video, width, height);
      drawOverlay(ctx, width, height, title, elapsed, { typoScale, overlay });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  video.pause();
  if (recorder.state !== "inactive") recorder.stop();
  const blob = await done;
  URL.revokeObjectURL(video.src);
  return { blob, mime, duration };
}

/** 拡張子から動画判定（iPhone の .mov で type が空の場合もある） */
export function isVideoFile(file: File): boolean {
  if (file.type.startsWith("video/")) return true;
  return /\.(mov|mp4|m4v|webm|avi|mkv)$/i.test(file.name);
}
