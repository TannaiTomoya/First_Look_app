import { register, type StructureMetrics } from "./canonical";
import {
  buildImageMesh,
  cheekWeights,
  countFlipped,
  flippedTriangles,
  headFrame,
  jawWeights,
  meshPositions,
  type FaceData,
  type HeadFrame,
  type ImageMesh,
  type Vec3,
} from "./geometry";

/**
 * Future Face のパラメータ。
 * 形状（contourPct / cheekPct）は 3D メッシュ変形、肌（clarity / nasolabial）は 2D 画像処理。
 */
export type FutureParams = {
  /** 顎幅（172–397）の変化率 % */
  contourPct: number;
  /** 頬幅（234–454）の変化率 % */
  cheekPct: number;
  /** 透明感・くすみ 0〜100 */
  clarity: number;
  /** ほうれい線 0〜100 */
  nasolabial: number;
};

export const PARAM_SPECS: Array<{
  key: keyof FutureParams;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}> = [
  { key: "contourPct", label: "輪郭（顎幅）", min: -15, max: 0, step: 0.5, unit: "%" },
  { key: "cheekPct", label: "頬幅", min: -10, max: 0, step: 0.5, unit: "%" },
  { key: "clarity", label: "透明感", min: 0, max: 100, step: 1, unit: "" },
  { key: "nasolabial", label: "ほうれい線", min: 0, max: 100, step: 1, unit: "" },
];

export const ZERO_PARAMS: FutureParams = { contourPct: 0, cheekPct: 0, clarity: 0, nasolabial: 0 };

export type Stage = "original" | "slim" | "skin" | "target";

export const STAGES: Array<{ key: Stage; label: string }> = [
  { key: "original", label: "Original" },
  { key: "slim", label: "Slim" },
  { key: "skin", label: "Skin" },
  { key: "target", label: "Target" },
];

/** 段階ごとに有効にする層。Slim = 形状のみ、Skin = 肌のみ、Target = 両方 */
export function paramsForStage(p: FutureParams, stage: Stage): FutureParams {
  const shape = stage === "slim" || stage === "target";
  const skin = stage === "skin" || stage === "target";
  return {
    contourPct: shape ? p.contourPct : 0,
    cheekPct: shape ? p.cheekPct : 0,
    clarity: skin ? p.clarity : 0,
    nasolabial: skin ? p.nasolabial : 0,
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * 旧 static/js/future_face.js の preset + strength(0〜100) との対応。
 * slim は顎・頬の外周をまとめて縮めていたので両方に配分し、
 * skin / young は旧方式の適用率の範囲（40〜60% / 15〜35%）をそのまま 0〜100 に写す。
 */
export function legacyToParams(preset: "slim" | "skin" | "young" | "all", strength: number): FutureParams {
  const s = Math.min(1, Math.max(0, strength / 100));
  const slim = preset === "slim" || preset === "all";
  const skin = preset === "skin" || preset === "all";
  const young = preset === "young" || preset === "all";
  return {
    contourPct: slim ? round1(-lerp(4, 12, s)) : 0,
    cheekPct: slim ? round1(-lerp(2, 6, s)) : 0,
    clarity: skin ? Math.round(lerp(67, 100, s)) : 0,
    nasolabial: young ? Math.round(lerp(43, 100, s)) : 0,
  };
}

export type ShapeModel = {
  face: FaceData;
  frame: HeadFrame;
  matrix: number[] | null;
  jaw: Float32Array;
  cheek: Float32Array;
  mesh: ImageMesh;
  base: StructureMetrics;
};

export function shapeModel(face: FaceData, matrix: number[] | null): ShapeModel {
  const frame = headFrame(face.points);
  return {
    face,
    frame,
    matrix,
    jaw: jawWeights(face, frame),
    cheek: cheekWeights(face, frame),
    mesh: buildImageMesh(face),
    base: register(face, matrix).metrics,
  };
}

/** 顔ローカル x を (1 - sJaw·wJaw - sCheek·wCheek) 倍にする */
export function deformShape(m: ShapeModel, sJaw: number, sCheek: number): Vec3[] {
  const { origin, ex } = m.frame;
  const points = m.face.points.map((p, i): Vec3 => {
    const k = sJaw * m.jaw[i] + sCheek * m.cheek[i];
    if (!k) return p;
    const lx = (p[0] - origin[0]) * ex[0] + (p[1] - origin[1]) * ex[1] + (p[2] - origin[2]) * ex[2];
    return [p[0] - ex[0] * k * lx, p[1] - ex[1] * k * lx, p[2] - ex[2] * k * lx];
  });
  return points;
}

/** 顎幅・頬幅の測定点。裏返りの修正でも動かさない */
const MEASURE_IDX = new Set([172, 397, 234, 454]);

/**
 * 横向きの写真では奥側の輪郭と内側の点が画像上で詰まり、輪郭が内側の点を追い越して三角形が裏返る。
 * 裏返った三角形では、いちばん大きく動いた頂点の移動に他の頂点を寄せる（内側の点も一緒に押し込む）。
 * それでも残る場合は、測定点以外の移動量を戻して必ず解消する。
 */
function relaxFlips(m: ShapeModel, points: Vec3[]): Vec3[] {
  const base = m.face.points;
  const disp = (q: Vec3[], i: number): Vec3 => [q[i][0] - base[i][0], q[i][1] - base[i][1], q[i][2] - base[i][2]];
  const movable = (i: number) => i < m.mesh.faceCount && !MEASURE_IDX.has(i);
  let cur = points;
  for (let iter = 0; iter < 24; iter++) {
    const bad = flippedTriangles(m.mesh, meshPositions(m.mesh, cur));
    if (!bad.length) break;
    const next = cur.slice();
    const pull = iter < 16;
    for (let t = 0; t < bad.length; t += 3) {
      const tri = bad.slice(t, t + 3).filter((i) => i < m.mesh.faceCount);
      if (!tri.length) continue;
      const lead = tri.reduce((a, b) => (Math.hypot(...disp(cur, b)) > Math.hypot(...disp(cur, a)) ? b : a));
      const target = pull ? disp(cur, lead) : ([0, 0, 0] as Vec3);
      for (const i of tri) {
        if (!movable(i) || (pull && i === lead)) continue;
        const d = disp(cur, i);
        next[i] = [0, 1, 2].map((a) => base[i][a] + 0.5 * (d[a] + target[a])) as Vec3;
      }
    }
    cur = next;
  }
  return cur;
}

export type ShapeMeasure = { contourPct: number; cheekPct: number };

/** 姿勢を除いた canonical 座標で、元の顔に対する顎幅・頬幅の変化率を測る */
export function measureShape(m: ShapeModel, points: Vec3[]): ShapeMeasure {
  const after = register({ ...m.face, points }, m.matrix).metrics;
  return {
    contourPct: (after.jawWidth / m.base.jawWidth - 1) * 100,
    cheekPct: (after.cheekWidth / m.base.cheekWidth - 1) * 100,
  };
}

/** 画像平面（見た目）での顎幅・頬幅の変化率 */
export function measureShapeImage(m: ShapeModel, points: Vec3[]): ShapeMeasure {
  const w = (q: Vec3[], a: number, b: number) => Math.hypot(q[a][0] - q[b][0], q[a][1] - q[b][1]);
  const p = m.face.points;
  return {
    contourPct: (w(points, 172, 397) / w(p, 172, 397) - 1) * 100,
    cheekPct: (w(points, 234, 454) / w(p, 234, 454) - 1) * 100,
  };
}

export type ShapeResult = {
  points: Vec3[];
  positions: Float64Array;
  measured: ShapeMeasure;
  sJaw: number;
  sCheek: number;
  /** 範囲内の強度で目標に届いたか */
  reachable: boolean;
  flipped: number;
};

const S_MAX = 0.6;
const S_MIN = -0.2;

/** 目標値と実測値の差の許容（#8 の完了条件） */
export const SHAPE_TOLERANCE_PT = 0.5;

/**
 * 目標の変化率になるよう変形強度を二分探索する。
 * 顎と頬は互いに少し影響し合うので、交互に解き直して収束させる。
 */
export function solveShape(m: ShapeModel, contourPct: number, cheekPct: number): ShapeResult {
  let sJaw = 0;
  let sCheek = 0;
  let reachable = true;

  // 目標 0 でも、もう一方の変形が波及した分は打ち消す（負の強度 = わずかに広げる）
  const solve = (target: number, key: keyof ShapeMeasure, at: (s: number) => [number, number]) => {
    const pct = (s: number) => measureShape(m, deformShape(m, ...at(s)))[key];
    if (Math.abs(pct(0) - target) < 1e-4) return 0;
    if (pct(S_MAX) > target || pct(S_MIN) < target) {
      reachable = false;
      return pct(S_MAX) > target ? S_MAX : S_MIN;
    }
    let lo = S_MIN;
    let hi = S_MAX;
    for (let k = 0; k < 28; k++) {
      const mid = (lo + hi) / 2;
      if (pct(mid) > target) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };

  for (let round = 0; round < 3; round++) {
    reachable = true;
    sJaw = solve(contourPct, "contourPct", (s) => [s, sCheek]);
    sCheek = solve(cheekPct, "cheekPct", (s) => [sJaw, s]);
  }

  // 探索は単調な変形で行い、裏返りの修正は最後に一度だけかける（修正後の値を実測として返す）
  const points = relaxFlips(m, deformShape(m, sJaw, sCheek));
  const positions = meshPositions(m.mesh, points);
  return {
    points,
    positions,
    measured: measureShape(m, points),
    sJaw,
    sCheek,
    reachable,
    flipped: countFlipped(m.mesh, positions),
  };
}
