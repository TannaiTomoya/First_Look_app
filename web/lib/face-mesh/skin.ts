"use client";

import type { SkinMetrics } from "@/lib/face-tools";
import { EYE_IDX, FACE_OVAL_IDX, LIP_IDX, type Vec3 } from "./geometry";

/**
 * Skin 層（2D）。旧 static/js/future_face.js の skinEnhance / reduceNasolabialFolds を移植。
 * ぼかしは分離型の移動平均にして、900px 画像でもスライダー操作に追従できる速さにしている。
 */

const LEFT_EYE = EYE_IDX.slice(0, 16);
const RIGHT_EYE = EYE_IDX.slice(16);
const MOUTH = LIP_IDX.slice(0, 20);
const NOSTRIL_IDX = [98, 97, 2, 326, 327];

export type SkinPrep = {
  width: number;
  height: number;
  src: Uint8ClampedArray;
  /** 透明感用の軽いぼかし（半径2） */
  smooth: Uint8ClampedArray;
  /** ほうれい線用の局所平均輝度（半径10） */
  localLuma: Float32Array;
  skinMask: Float32Array;
  foldMask: Float32Array;
};

function boxBlur1D(src: Float32Array, W: number, H: number, r: number, horizontal: boolean): Float32Array {
  const out = new Float32Array(src.length);
  const len = horizontal ? W : H;
  const lines = horizontal ? H : W;
  for (let line = 0; line < lines; line++) {
    const at = (k: number) => (horizontal ? line * W + k : k * W + line);
    let sum = 0;
    let count = 0;
    for (let k = 0; k <= Math.min(r, len - 1); k++) {
      sum += src[at(k)];
      count++;
    }
    for (let k = 0; k < len; k++) {
      out[at(k)] = sum / count;
      const add = k + r + 1;
      const drop = k - r;
      if (add < len) {
        sum += src[at(add)];
        count++;
      }
      if (drop >= 0) {
        sum -= src[at(drop)];
        count--;
      }
    }
  }
  return out;
}

const blur = (src: Float32Array, W: number, H: number, r: number) =>
  boxBlur1D(boxBlur1D(src, W, H, r, true), W, H, r, false);

function blurRGB(data: Uint8ClampedArray, W: number, H: number, r: number): Uint8ClampedArray {
  const n = W * H;
  const out = new Uint8ClampedArray(data);
  for (let c = 0; c < 3; c++) {
    const ch = new Float32Array(n);
    for (let i = 0; i < n; i++) ch[i] = data[i * 4 + c];
    const b = blur(ch, W, H, r);
    for (let i = 0; i < n; i++) out[i * 4 + c] = b[i];
  }
  return out;
}

function rasterMask(W: number, H: number, draw: (ctx: CanvasRenderingContext2D) => void, feather: number) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  draw(ctx);
  const img = ctx.getImageData(0, 0, W, H).data;
  const mask = new Float32Array(W * H);
  for (let i = 0; i < mask.length; i++) mask[i] = img[i * 4] / 255;
  return blur(mask, W, H, feather);
}

function fillPolygon(ctx: CanvasRenderingContext2D, points: Vec3[], idx: number[]) {
  ctx.beginPath();
  idx.forEach((i, k) => (k === 0 ? ctx.moveTo(points[i][0], points[i][1]) : ctx.lineTo(points[i][0], points[i][1])));
  ctx.closePath();
  ctx.fill();
}

/** 顔の輪郭から目・口・鼻孔を除いた肌マスク */
function skinMask(W: number, H: number, points: Vec3[]) {
  return rasterMask(
    W,
    H,
    (ctx) => {
      ctx.fillStyle = "white";
      fillPolygon(ctx, points, FACE_OVAL_IDX);
      ctx.fillStyle = "black";
      for (const idx of [LEFT_EYE, RIGHT_EYE, MOUTH]) fillPolygon(ctx, points, idx);
      for (const i of NOSTRIL_IDX) {
        ctx.beginPath();
        ctx.arc(points[i][0], points[i][1], W * 0.015, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    8,
  );
}

/** 鼻翼の付け根 → 口角の帯（ほうれい線） */
function foldMask(W: number, H: number, points: Vec3[]) {
  return rasterMask(
    W,
    H,
    (ctx) => {
      ctx.strokeStyle = "white";
      ctx.lineWidth = W * 0.03;
      ctx.lineCap = "round";
      for (const [a, b] of [
        [198, 61],
        [419, 291],
      ]) {
        ctx.beginPath();
        ctx.moveTo(points[a][0], points[a][1]);
        ctx.lineTo(points[b][0], points[b][1]);
        ctx.stroke();
      }
    },
    12,
  );
}

export function prepareSkin(source: HTMLCanvasElement, points: Vec3[]): SkinPrep {
  const W = source.width;
  const H = source.height;
  const src = source.getContext("2d")!.getImageData(0, 0, W, H).data;
  const luma = new Float32Array(W * H);
  for (let i = 0; i < luma.length; i++) {
    luma[i] = 0.299 * src[i * 4] + 0.587 * src[i * 4 + 1] + 0.114 * src[i * 4 + 2];
  }
  return {
    width: W,
    height: H,
    src,
    smooth: blurRGB(src, W, H, 2),
    localLuma: blur(luma, W, H, 10),
    skinMask: skinMask(W, H, points),
    foldMask: foldMask(W, H, points),
  };
}

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

/**
 * clarity: 肌マスク内をなめらかにし、ガンマで明るく・彩度を少し上げてくすみを抑える（旧 skinEnhance）。
 * nasolabial: ほうれい線の帯で、局所平均より暗い影だけを持ち上げる。
 */
export function renderSkin(prep: SkinPrep, clarity: number, nasolabial: number): HTMLCanvasElement {
  const { width: W, height: H, src, smooth, localLuma, skinMask: sm, foldMask: fm } = prep;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const c = Math.min(1, Math.max(0, clarity / 100));
  const f = Math.min(1, Math.max(0, nasolabial / 100));
  if (!c && !f) {
    ctx.putImageData(new ImageData(new Uint8ClampedArray(src), W, H), 0, 0);
    return canvas;
  }

  const alpha = 0.6 * c;
  const invGamma = 1 / (1 + 0.15 * c);
  const sat = 1 + 0.1 * c;
  const lift = 0.5 * f;
  const lut = new Float32Array(256);
  for (let v = 0; v < 256; v++) lut[v] = Math.pow(v / 255, invGamma) * 255;

  const out = new Uint8ClampedArray(src.length);
  for (let i = 0, p = 0; i < src.length; i += 4, p++) {
    let r = src[i];
    let g = src[i + 1];
    let b = src[i + 2];

    const ws = sm[p] * alpha;
    if (ws > 0.001) {
      let tr = lut[smooth[i]];
      let tg = lut[smooth[i + 1]];
      let tb = lut[smooth[i + 2]];
      const avg = (tr + tg + tb) / 3;
      tr = avg + (tr - avg) * sat;
      tg = avg + (tg - avg) * sat;
      tb = avg + (tb - avg) * sat;
      r += (tr - r) * ws;
      g += (tg - g) * ws;
      b += (tb - b) * ws;
    }

    const wf = fm[p] * lift;
    if (wf > 0.001) {
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      const shadow = localLuma[p] - luma;
      if (shadow > 0) {
        r += shadow * wf;
        g += shadow * wf;
        b += shadow * wf;
      }
    }

    out[i] = clamp255(r);
    out[i + 1] = clamp255(g);
    out[i + 2] = clamp255(b);
    out[i + 3] = src[i + 3];
  }
  ctx.putImageData(new ImageData(out, W, H), 0, 0);
  return canvas;
}

/** ほうれい線の帯で、局所平均より暗い分の平均（影の濃さ）。輝度の差で表す */
export function foldShadow(prep: SkinPrep, canvas: HTMLCanvasElement): number {
  const data = canvas.getContext("2d")!.getImageData(0, 0, prep.width, prep.height).data;
  let wsum = 0;
  let sum = 0;
  for (let p = 0, i = 0; p < prep.foldMask.length; p++, i += 4) {
    const w = prep.foldMask[p];
    if (w < 0.3) continue;
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    wsum += w;
    sum += w * Math.max(0, prep.localLuma[p] - lum);
  }
  return Math.round((sum / (wsum || 1)) * 10) / 10;
}

/**
 * 肌マスクで重み付けした明るさ・コントラスト・赤み（analyzeSkin と同じ定義）。
 * 背景や髪を含む矩形で測ると変化が埋もれるため、肌の部分だけで測る。
 */
export function skinMetrics(prep: SkinPrep, canvas: HTMLCanvasElement): SkinMetrics {
  const data = canvas.getContext("2d")!.getImageData(0, 0, prep.width, prep.height).data;
  const mask = prep.skinMask;
  let wsum = 0;
  let sum = 0;
  let sumSq = 0;
  let red = 0;
  let shine = 0;
  for (let p = 0, i = 0; p < mask.length; p++, i += 4) {
    const w = mask[p];
    if (w < 0.5) continue;
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    wsum += w;
    sum += w * lum;
    sumSq += w * lum * lum;
    red += w * (data[i] - (data[i + 1] + data[i + 2]) / 2);
    if (lum > 235) shine += w;
  }
  const n = wsum || 1;
  const mean = sum / n;
  return {
    brightness: Math.round(mean * 10) / 10,
    contrast: Math.round(Math.sqrt(Math.max(0, sumSq / n - mean * mean)) * 10) / 10,
    redness: Math.round((red / n) * 10) / 10,
    shineRatio: shine / n,
  };
}
