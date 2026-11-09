import type { FaceData, Vec3 } from "./geometry";

/**
 * Registration：検出点群（ピクセル空間）→ 姿勢を除いた canonical 座標。
 * カメラ座標は x右・y上・z手前（MediaPipe の transformation matrix と同じ向き）。
 * スケールは外眼角間距離（33–263）を 1 とする。体型変化で動きにくい長さ。
 */

export type Pose = { yaw: number; pitch: number; roll: number };
export type RegistrationSource = "matrix" | "landmarks";

export type StructureMetrics = {
  /** 顎幅 / 外眼角間距離 */
  jawWidth: number;
  /** 頬幅 / 外眼角間距離 */
  cheekWidth: number;
  /** 顎幅 / 頬幅（例: 0.86） */
  jawRatio: number;
  /** 顔の縦（額–顎先） / 頬幅 */
  faceAspect: number;
};

export type Registration = {
  source: RegistrationSource;
  pose: Pose;
  points: Vec3[];
  metrics: StructureMetrics;
};

type Basis = { ex: Vec3; ey: Vec3; ez: Vec3 };

const EYE_OUTER_R = 33;
const EYE_OUTER_L = 263;
const FOREHEAD = 10;
const SUBNASALE = 2;
const NOSE_BRIDGE = 168;
const CHIN = 152;
const CHEEK_R = 234;
const CHEEK_L = 454;
const JAW_R = 172;
const JAW_L = 397;

/** 品質ゲート。超えたら保存はするが「参考値」扱い */
export const POSE_LIMIT = { yaw: 25, pitch: 20 };
export const JAW_OPEN_LIMIT = 0.15;

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: Vec3): Vec3 => scale(a, 1 / (len(a) || 1));
const deg = (r: number) => (r * 180) / Math.PI;

/** ピクセル空間（y下・z奥が正）→ カメラ空間（y上・z手前が正） */
const toCamera = (p: Vec3): Vec3 => [p[0], -p[1], -p[2]];

function orthonormal(xRaw: Vec3, yRaw: Vec3): Basis {
  const ex = norm(xRaw);
  const ey = norm(sub(yRaw, scale(ex, dot(yRaw, ex))));
  return { ex, ey, ez: cross(ex, ey) };
}

/** 剛体とみなせる点（外眼角・額・鼻下）から頭部の向きを求める。表情や顎の開閉に引きずられない */
function basisFromLandmarks(cam: Vec3[]): Basis {
  return orthonormal(sub(cam[EYE_OUTER_L], cam[EYE_OUTER_R]), sub(cam[FOREHEAD], cam[SUBNASALE]));
}

/**
 * transformation matrix（canonical → カメラ）の回転部分。
 * 平行移動の z（頭までの距離, 数十cm）がどこに入っているかで列優先/行優先を判定する。
 */
function basisFromMatrix(m: number[]): Basis | null {
  if (m.length !== 16) return null;
  const colMajor = Math.abs(m[14]) >= Math.abs(m[11]);
  const col = (j: number): Vec3 =>
    colMajor ? [m[j * 4], m[j * 4 + 1], m[j * 4 + 2]] : [m[j], m[4 + j], m[8 + j]];
  const b = orthonormal(col(0), col(1));
  return Number.isFinite(b.ez[0]) ? b : null;
}

function poseOf({ ex, ez }: Basis): Pose {
  return {
    yaw: deg(Math.atan2(ez[0], ez[2])),
    pitch: deg(Math.atan2(ez[1], Math.hypot(ez[0], ez[2]))),
    roll: deg(Math.atan2(ex[1], ex[0])),
  };
}

export function structureMetrics(q: Vec3[]): StructureMetrics {
  const jawWidth = Math.abs(q[JAW_L][0] - q[JAW_R][0]);
  const cheekWidth = Math.abs(q[CHEEK_L][0] - q[CHEEK_R][0]);
  return {
    jawWidth,
    cheekWidth,
    jawRatio: jawWidth / (cheekWidth || 1),
    faceAspect: Math.abs(q[FOREHEAD][1] - q[CHIN][1]) / (cheekWidth || 1),
  };
}

export function register(
  face: FaceData,
  matrix: number[] | null,
  prefer: RegistrationSource = "matrix",
): Registration {
  const cam = face.points.map(toCamera);
  const fromMatrix = prefer === "matrix" && matrix ? basisFromMatrix(matrix) : null;
  const basis = fromMatrix ?? basisFromLandmarks(cam);
  const unit = len(sub(cam[EYE_OUTER_L], cam[EYE_OUTER_R])) || 1;
  const o = cam[NOSE_BRIDGE];
  const points = cam.map((p): Vec3 => {
    const d = sub(p, o);
    return [dot(d, basis.ex) / unit, dot(d, basis.ey) / unit, dot(d, basis.ez) / unit];
  });
  return {
    source: fromMatrix ? "matrix" : "landmarks",
    pose: poseOf(basis),
    points,
    metrics: structureMetrics(points),
  };
}

/** 比較用：姿勢補正なしで画像平面上の長さから出した指標 */
export function naiveMetrics(face: FaceData): StructureMetrics {
  const p = face.points;
  const unit = Math.hypot(p[EYE_OUTER_L][0] - p[EYE_OUTER_R][0], p[EYE_OUTER_L][1] - p[EYE_OUTER_R][1]) || 1;
  return structureMetrics(p.map((v): Vec3 => [v[0] / unit, -v[1] / unit, 0]));
}

export function qualityIssues(pose: Pose, jawOpen: number): string[] {
  const issues: string[] = [];
  if (Math.abs(pose.yaw) > POSE_LIMIT.yaw) issues.push(`横向き ${pose.yaw.toFixed(0)}°`);
  if (Math.abs(pose.pitch) > POSE_LIMIT.pitch) issues.push(`上下 ${pose.pitch.toFixed(0)}°`);
  if (jawOpen > JAW_OPEN_LIMIT) issues.push("口が開いている");
  return issues;
}

/** 2つの指標の最大相対差（%）。同一人物・別角度で小さいほど正規化が効いている */
export function maxRelativeDiffPct(a: StructureMetrics, b: StructureMetrics): number {
  const keys: Array<keyof StructureMetrics> = ["jawWidth", "cheekWidth", "jawRatio", "faceAspect"];
  return Math.max(...keys.map((k) => (Math.abs(a[k] - b[k]) / (Math.abs(a[k]) || 1)) * 100));
}

/** 完了条件（#5）の許容範囲 */
export const REGISTRATION_TOLERANCE_PCT = 3;
