import Delaunator from "delaunator";

export type Vec3 = [number, number, number];

/** ピクセル空間の顔データ（x右・y下、z は画像幅スケール） */
export type FaceData = {
  width: number;
  height: number;
  points: Vec3[];
  edges: Array<[number, number]>;
};

export type HeadFrame = { origin: Vec3; ex: Vec3; ey: Vec3; ez: Vec3 };

/** 顎〜頬の外周（輪郭に沿った順序） */
export const JAW_CONTOUR_IDX = [
  234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152,
  377, 400, 378, 379, 365, 397, 288, 361, 323, 454,
];

const JAW_SEED_IDX = [132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361];

export const FACE_OVAL_IDX = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
  397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
  172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
];

const MIDLINE_IDX = [10, 151, 9, 8, 168, 6, 197, 195, 5, 4, 1, 0, 13, 14, 17, 18, 200, 199, 175, 152];

export const EYE_IDX = [
  33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246,
  263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466,
];

export const NOSE_IDX = [
  1, 2, 3, 4, 5, 6, 19, 44, 45, 48, 49, 51, 64, 94, 97, 98, 102, 115, 129, 131, 134,
  168, 195, 197, 198, 209, 220, 236, 248, 274, 275, 278, 279, 281, 294, 326, 327,
  331, 344, 358, 360, 363, 420, 429, 440, 456,
];

export const LIP_IDX = [
  61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146,
  78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 191, 80, 81, 82, 13, 312, 311, 310, 415,
];

const PROTECTED = new Set([...EYE_IDX, ...NOSE_IDX, ...LIP_IDX]);

export const JAW_LEFT = 172;
export const JAW_RIGHT = 397;
const NOSE_TIP = 1;
const CHIN = 152;

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: Vec3): Vec3 => scale(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (t: number) => t * t * (3 - 2 * t);
const dist2 = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** 顔のローカル座標系（ex: 左右, ey: 上, ez: 前後）。姿勢に依存しない変形方向を作る */
export function headFrame(p: Vec3[]): HeadFrame {
  const ex = norm(sub(p[454], p[234]));
  const upRaw = sub(p[10], p[152]);
  const ey = norm(sub(upRaw, scale(ex, dot(upRaw, ex))));
  const ez = cross(ex, ey);
  const sum = MIDLINE_IDX.reduce<Vec3>((acc, i) => add(acc, p[i]), [0, 0, 0]);
  return { origin: scale(sum, 1 / MIDLINE_IDX.length), ex, ey, ez };
}

export function toLocal(f: HeadFrame, v: Vec3): Vec3 {
  const d = sub(v, f.origin);
  return [dot(d, f.ex), dot(d, f.ey), dot(d, f.ez)];
}

function adjacency(n: number, edges: Array<[number, number]>) {
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const [a, b] of edges) {
    if (a >= n || b >= n) continue;
    adj[a].push(b);
    adj[b].push(a);
  }
  return adj;
}

/**
 * 顎頂点群の重み。ピクセル半径ではなくメッシュ上のホップ距離で減衰させるので、
 * 画像上で近いだけの鼻・口には波及しない。
 */
export function jawWeights(face: FaceData, frame: HeadFrame, hops = 5): Float32Array {
  const yNose = toLocal(frame, face.points[NOSE_TIP])[1];
  const yChin = toLocal(frame, face.points[CHIN])[1];
  return regionWeights(face, frame, JAW_SEED_IDX, hops, (y) =>
    clamp01(((yNose - y) / (yNose - yChin || 1)) * 1.6),
  );
}

/** 頬骨まわりの外周（頬幅 234–454 を動かす） */
const CHEEK_SEED_IDX = [234, 93, 127, 454, 323, 356];

/** 頬の重み。頬幅の高さを中心に、目の高さ・口の高さに向かって減衰させる */
export function cheekWeights(face: FaceData, frame: HeadFrame, hops = 4): Float32Array {
  const p = face.points;
  const yCheek = (toLocal(frame, p[234])[1] + toLocal(frame, p[454])[1]) / 2;
  const h = Math.abs(toLocal(frame, p[NOSE_TIP])[1] - toLocal(frame, p[CHIN])[1]) || 1;
  return regionWeights(face, frame, CHEEK_SEED_IDX, hops, (y) => clamp01(1 - Math.abs(y - yCheek) / (0.9 * h)));
}

function regionWeights(
  face: FaceData,
  frame: HeadFrame,
  seedIdx: number[],
  hops: number,
  band: (localY: number) => number,
): Float32Array {
  const n = face.points.length;
  const adj = adjacency(n, face.edges);
  const hop = new Int32Array(n).fill(-1);
  const queue: number[] = [];
  for (const s of seedIdx) {
    hop[s] = 0;
    queue.push(s);
  }
  for (let h = 0; h < queue.length; h++) {
    const u = queue[h];
    if (hop[u] >= hops) continue;
    for (const v of adj[u]) {
      if (hop[v] < 0) {
        hop[v] = hop[u] + 1;
        queue.push(v);
      }
    }
  }

  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (hop[i] < 0 || PROTECTED.has(i)) continue;
    const g = smooth(1 - hop[i] / (hops + 1));
    w[i] = g * band(toLocal(frame, face.points[i])[1]);
  }

  const seeds = new Set(seedIdx);
  for (let pass = 0; pass < 3; pass++) {
    const prev = w.slice();
    for (let i = 0; i < n; i++) {
      if (PROTECTED.has(i) || seeds.has(i) || !adj[i].length || hop[i] < 0) continue;
      const m = adj[i].reduce((s, j) => s + prev[j], 0) / adj[i].length;
      w[i] = 0.5 * prev[i] + 0.5 * m;
    }
  }
  return w;
}

/** 顔ローカル x を (1 - s·w) 倍にする。s=0.05 で顎幅 約5% 減 */
export function deformJaw(face: FaceData, frame: HeadFrame, weights: Float32Array, s: number): Vec3[] {
  return face.points.map((p, i) => {
    const w = weights[i];
    if (!w || !s) return p;
    const lx = dot(sub(p, frame.origin), frame.ex);
    return add(p, scale(frame.ex, -s * w * lx));
  });
}

/** 画像全体を覆う三角形メッシュ（顔468点 + 顔外周リング + 画像の縁） */
export type ImageMesh = {
  /** 元の2D座標 [x0,y0,x1,y1,...] */
  base: Float64Array;
  triangles: Uint32Array;
  faceCount: number;
};

export function buildImageMesh(face: FaceData): ImageMesh {
  const { width: W, height: H } = face;
  const faceCount = Math.min(468, face.points.length);
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < faceCount; i++) pts.push([face.points[i][0], face.points[i][1]]);

  let cx = 0;
  let cy = 0;
  for (const i of FACE_OVAL_IDX) {
    cx += face.points[i][0];
    cy += face.points[i][1];
  }
  cx /= FACE_OVAL_IDX.length;
  cy /= FACE_OVAL_IDX.length;
  for (const i of FACE_OVAL_IDX) {
    const [x, y] = face.points[i];
    pts.push([
      Math.min(W, Math.max(0, cx + (x - cx) * 1.45)),
      Math.min(H, Math.max(0, cy + (y - cy) * 1.45)),
    ]);
  }

  const steps = 6;
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    pts.push([t * W, 0], [t * W, H]);
    if (k > 0 && k < steps) pts.push([0, t * H], [W, t * H]);
  }

  const base = new Float64Array(pts.length * 2);
  pts.forEach(([x, y], i) => {
    base[i * 2] = x;
    base[i * 2 + 1] = y;
  });
  const d = new Delaunator(base);
  return { base, triangles: d.triangles, faceCount };
}

export function meshPositions(mesh: ImageMesh, deformed: Vec3[]): Float64Array {
  const out = mesh.base.slice();
  for (let i = 0; i < mesh.faceCount; i++) {
    out[i * 2] = deformed[i][0];
    out[i * 2 + 1] = deformed[i][1];
  }
  return out;
}

export function countFlipped(mesh: ImageMesh, pos: Float64Array): number {
  return flippedTriangles(mesh, pos).length / 3;
}

/** 反転（または潰れた）三角形の頂点インデックスを3つずつ並べて返す */
export function flippedTriangles(mesh: ImageMesh, pos: Float64Array): number[] {
  const area = (p: Float64Array, a: number, b: number, c: number) =>
    (p[b * 2] - p[a * 2]) * (p[c * 2 + 1] - p[a * 2 + 1]) -
    (p[c * 2] - p[a * 2]) * (p[b * 2 + 1] - p[a * 2 + 1]);
  const out: number[] = [];
  const t = mesh.triangles;
  for (let i = 0; i < t.length; i += 3) {
    const before = area(mesh.base, t[i], t[i + 1], t[i + 2]);
    const after = area(pos, t[i], t[i + 1], t[i + 2]);
    if (Math.sign(before) !== Math.sign(after) || Math.abs(after) < 1e-6) out.push(t[i], t[i + 1], t[i + 2]);
  }
  return out;
}

/* ---------- 旧方式（static/js/future_face.js の slimJaw を移植） ---------- */

function legacyWarps(face: FaceData, strength01: number) {
  const W = face.width;
  const amount = 0.02 + (0.06 - 0.02) * clamp01(strength01);
  const cx = (face.points[234][0] + face.points[454][0]) / 2;
  const radius = Math.round(W * 0.08);
  return JAW_CONTOUR_IDX.map((i) => {
    const [x, y] = face.points[i];
    return { sx: x, sy: y, dx: (cx - x) * amount, radius };
  });
}

/** 旧方式の見かけの移動先（逐次ワープを順に追跡） */
export function legacyTrack(face: FaceData, strength01: number, q: [number, number]): [number, number] {
  let px = q[0];
  const py = q[1];
  for (const w of legacyWarps(face, strength01)) {
    const r2 = w.radius * w.radius;
    let x = px;
    for (let k = 0; k < 4; k++) {
      const d2 = (x - w.sx) ** 2 + (py - w.sy) ** 2;
      const wt = d2 > r2 ? 0 : 1 - d2 / r2;
      x = px + w.dx * wt;
    }
    px = x;
  }
  return [px, py];
}

/** 旧方式の画像出力（ニアレストネイバーの逐次局所ワープ） */
export function renderLegacy(src: ImageData, face: FaceData, strength01: number): ImageData {
  const W = src.width;
  const H = src.height;
  let cur = src.data;
  for (const w of legacyWarps(face, strength01)) {
    const out = new Uint8ClampedArray(cur);
    const r2 = w.radius * w.radius;
    const minX = Math.max(0, Math.floor(w.sx - w.radius));
    const maxX = Math.min(W - 1, Math.ceil(w.sx + w.radius));
    const minY = Math.max(0, Math.floor(w.sy - w.radius));
    const maxY = Math.min(H - 1, Math.ceil(w.sy + w.radius));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const d2 = (x - w.sx) ** 2 + (y - w.sy) ** 2;
        if (d2 > r2) continue;
        const wt = 1 - d2 / r2;
        const sx = Math.round(x - w.dx * wt);
        const sy = y;
        if (sx < 0 || sx >= W || sy < 0 || sy >= H) continue;
        const si = (sy * W + sx) * 4;
        const di = (y * W + x) * 4;
        out[di] = cur[si];
        out[di + 1] = cur[si + 1];
        out[di + 2] = cur[si + 2];
        out[di + 3] = cur[si + 3];
      }
    }
    cur = out;
  }
  return new ImageData(new Uint8ClampedArray(cur), W, H);
}

export type Crop = { x: number; y: number; w: number; h: number };

/** 顎まわり（鼻先〜顎先、輪郭の左右端）を余白付きで切り出す範囲 */
export function jawCrop(face: FaceData, pad = 0.18): Crop {
  const xs = JAW_CONTOUR_IDX.map((i) => face.points[i][0]);
  const top = face.points[NOSE_TIP][1];
  const bottom = face.points[CHIN][1];
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const w0 = maxX - minX;
  const h0 = bottom - top;
  const x = Math.max(0, minX - w0 * pad);
  const y = Math.max(0, top - h0 * pad);
  const w = Math.min(face.width - x, w0 * (1 + 2 * pad));
  const h = Math.min(face.height - y, h0 * (1 + 2 * pad) + h0 * 0.35);
  return { x, y, w, h };
}

/** 顔の輪郭（額〜顎先）を余白付きで切り出す範囲 */
export function faceCrop(face: FaceData, pad = 0.25): Crop {
  const xs = FACE_OVAL_IDX.map((i) => face.points[i][0]);
  const ys = FACE_OVAL_IDX.map((i) => face.points[i][1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w0 = Math.max(...xs) - minX;
  const h0 = Math.max(...ys) - minY;
  const x = Math.max(0, minX - w0 * pad);
  const y = Math.max(0, minY - h0 * pad);
  return {
    x,
    y,
    w: Math.min(face.width - x, w0 * (1 + 2 * pad)),
    h: Math.min(face.height - y, h0 * (1 + 2 * pad)),
  };
}

/* ---------- 比較指標 ---------- */

export type DeformMetrics = {
  jawWidthChangePct: number;
  /** 左右の顎の内向き移動量の比（1 = 完全対称） */
  symmetry: number;
  /** 鼻・目・口の平均移動 px */
  protectedShiftPx: number;
  /** 鼻先より上の点の平均移動 px（目的外の変形） */
  upperLeakPx: number;
  /** 輪郭に沿った移動量の二階差分 RMS px（波打ち） */
  contourRoughnessPx: number;
  flippedTriangles: number | null;
};

function contourSamples(per = 8) {
  const out: Array<{ a: number; b: number; t: number }> = [];
  for (let k = 0; k < JAW_CONTOUR_IDX.length - 1; k++) {
    for (let s = 0; s < per; s++) {
      out.push({ a: JAW_CONTOUR_IDX[k], b: JAW_CONTOUR_IDX[k + 1], t: s / per });
    }
  }
  const last = JAW_CONTOUR_IDX[JAW_CONTOUR_IDX.length - 1];
  out.push({ a: last, b: last, t: 0 });
  return out;
}

function roughness(disp: Array<[number, number]>) {
  if (disp.length < 3) return 0;
  let acc = 0;
  for (let i = 1; i < disp.length - 1; i++) {
    const ddx = disp[i - 1][0] - 2 * disp[i][0] + disp[i + 1][0];
    const ddy = disp[i - 1][1] - 2 * disp[i][1] + disp[i + 1][1];
    acc += ddx * ddx + ddy * ddy;
  }
  return Math.sqrt(acc / (disp.length - 2));
}

function summarize(
  face: FaceData,
  frame: HeadFrame,
  moved: (i: number) => [number, number],
  contourDisp: Array<[number, number]>,
  flipped: number | null,
): DeformMetrics {
  const p = face.points;
  const before = dist2(p[JAW_LEFT], p[JAW_RIGHT]);
  const l = moved(JAW_LEFT);
  const r = moved(JAW_RIGHT);
  const after = Math.hypot(l[0] - r[0], l[1] - r[1]);

  const exLen = Math.hypot(frame.ex[0], frame.ex[1]) || 1;
  const localDx = (i: number) => {
    const m = moved(i);
    return ((m[0] - p[i][0]) * frame.ex[0] + (m[1] - p[i][1]) * frame.ex[1]) / exLen;
  };
  const inL = Math.abs(localDx(JAW_LEFT));
  const inR = Math.abs(localDx(JAW_RIGHT));
  const symmetry = Math.max(inL, inR) < 1e-6 ? 1 : Math.min(inL, inR) / Math.max(inL, inR);

  const shift = (i: number) => {
    const m = moved(i);
    return Math.hypot(m[0] - p[i][0], m[1] - p[i][1]);
  };
  const protectedIdx = [...PROTECTED];
  const protectedShiftPx = protectedIdx.reduce((s, i) => s + shift(i), 0) / protectedIdx.length;

  const yNose = toLocal(frame, p[NOSE_TIP])[1];
  const upper: number[] = [];
  for (let i = 0; i < Math.min(468, p.length); i++) {
    if (toLocal(frame, p[i])[1] > yNose) upper.push(i);
  }
  const upperLeakPx = upper.length ? upper.reduce((s, i) => s + shift(i), 0) / upper.length : 0;

  return {
    jawWidthChangePct: ((after - before) / (before || 1)) * 100,
    symmetry,
    protectedShiftPx,
    upperLeakPx,
    contourRoughnessPx: roughness(contourDisp),
    flippedTriangles: flipped,
  };
}

export function meshMetrics(
  face: FaceData,
  frame: HeadFrame,
  deformed: Vec3[],
  mesh: ImageMesh,
): DeformMetrics {
  const p = face.points;
  const moved = (i: number): [number, number] => [deformed[i][0], deformed[i][1]];
  const contour = contourSamples().map(({ a, b, t }) => {
    const dx = (deformed[a][0] - p[a][0]) * (1 - t) + (deformed[b][0] - p[b][0]) * t;
    const dy = (deformed[a][1] - p[a][1]) * (1 - t) + (deformed[b][1] - p[b][1]) * t;
    return [dx, dy] as [number, number];
  });
  return summarize(face, frame, moved, contour, countFlipped(mesh, meshPositions(mesh, deformed)));
}

export function legacyMetrics(face: FaceData, frame: HeadFrame, strength01: number): DeformMetrics {
  const p = face.points;
  const moved = (i: number) => legacyTrack(face, strength01, [p[i][0], p[i][1]]);
  const contour = contourSamples().map(({ a, b, t }) => {
    const q: [number, number] = [
      p[a][0] * (1 - t) + p[b][0] * t,
      p[a][1] * (1 - t) + p[b][1] * t,
    ];
    const m = legacyTrack(face, strength01, q);
    return [m[0] - q[0], m[1] - q[1]] as [number, number];
  });
  return summarize(face, frame, moved, contour, null);
}

/** 3D点群を顔の縦軸まわりに回転し、正射影した顔データを作る（姿勢違いの擬似入力） */
export function rotateFaceYaw(face: FaceData, frame: HeadFrame, deg: number): FaceData {
  const t = (deg * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  const k = frame.ey;
  const points = face.points.map((p) => {
    const v = sub(p, frame.origin);
    const kv = cross(k, v);
    const kd = dot(k, v);
    const r: Vec3 = [
      v[0] * c + kv[0] * s + k[0] * kd * (1 - c),
      v[1] * c + kv[1] * s + k[1] * kd * (1 - c),
      v[2] * c + kv[2] * s + k[2] * kd * (1 - c),
    ];
    return add(r, frame.origin);
  });
  return { ...face, points };
}

export type PoseStability = {
  yaws: number[];
  mesh: { jawPct: number[]; symmetry: number[] };
  legacy: { jawPct: number[]; symmetry: number[] };
};

/** ±yaw の擬似姿勢で、同じ設定のまま顎幅変化率と対称性がどれだけブレるか */
export function poseStability(
  face: FaceData,
  frame: HeadFrame,
  meshScale: number,
  legacyStrength01: number,
  yaws = [-15, 0, 15],
): PoseStability {
  const out: PoseStability = {
    yaws,
    mesh: { jawPct: [], symmetry: [] },
    legacy: { jawPct: [], symmetry: [] },
  };
  for (const y of yaws) {
    const f = y === 0 ? face : rotateFaceYaw(face, frame, y);
    const fr = headFrame(f.points);
    const w = jawWeights(f, fr);
    const m = meshMetrics(f, fr, deformJaw(f, fr, w, meshScale), buildImageMesh(f));
    const l = legacyMetrics(f, fr, legacyStrength01);
    out.mesh.jawPct.push(m.jawWidthChangePct);
    out.mesh.symmetry.push(m.symmetry);
    out.legacy.jawPct.push(l.jawWidthChangePct);
    out.legacy.symmetry.push(l.symmetry);
  }
  return out;
}

/** 旧方式の強度を、メッシュ方式と同じ顎幅変化率になるよう二分探索 */
export function matchLegacyStrength(face: FaceData, frame: HeadFrame, targetPct: number) {
  const pct = (s: number) => legacyMetrics(face, frame, s).jawWidthChangePct;
  // 旧方式は強度0でも2%収縮するため、それより弱い変形には合わせられない
  if (pct(0) <= targetPct) return { strength01: 0, reachable: false };
  if (pct(1) > targetPct) return { strength01: 1, reachable: false };
  let lo = 0;
  let hi = 1;
  for (let k = 0; k < 20; k++) {
    const mid = (lo + hi) / 2;
    if (pct(mid) > targetPct) lo = mid;
    else hi = mid;
  }
  return { strength01: hi, reachable: true };
}
