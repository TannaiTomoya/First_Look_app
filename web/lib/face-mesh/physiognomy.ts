import type { Vec3 } from "./geometry";

/**
 * 人相リーディング用の顔比率。Face Landmarker の 478 点を `register()` で
 * 姿勢補正した canonical 座標（x右・y上、スケールは外眼角間距離）から測る。
 * 同じ画像なら必ず同じ値になる。
 */
export type FaceRatios = {
  /** 顔の縦（額上端 10 – 顎先 152）/ 頬幅（234–454） */
  faceAspect: number;
  /** 内眼角間（133–362）/ 頬幅 */
  eyeGap: number;
  /** 顎幅（172–397）/ 頬幅 */
  jawWidth: number;
  /**
   * 額上端（10）– 眉（105/334 の平均）/ 顔の縦。
   * メッシュの上端は生え際ではないため「額の広さ」は測れない。参考値としてのみ送る。
   */
  foreheadRatio: number;
};

const FOREHEAD_TOP = 10;
const CHIN = 152;
const CHEEK_R = 234;
const CHEEK_L = 454;
const JAW_R = 172;
const JAW_L = 397;
const EYE_INNER_R = 133;
const EYE_INNER_L = 362;
const BROW_R = 105;
const BROW_L = 334;

export function physiognomyRatios(q: Vec3[]): FaceRatios {
  const cheek = Math.abs(q[CHEEK_L][0] - q[CHEEK_R][0]) || 1;
  const faceHeight = Math.abs(q[FOREHEAD_TOP][1] - q[CHIN][1]) || 1;
  const browY = (q[BROW_R][1] + q[BROW_L][1]) / 2;
  return {
    faceAspect: round3(faceHeight / cheek),
    eyeGap: round3(Math.abs(q[EYE_INNER_L][0] - q[EYE_INNER_R][0]) / cheek),
    jawWidth: round3(Math.abs(q[JAW_L][0] - q[JAW_R][0]) / cheek),
    foreheadRatio: round3(Math.abs(q[FOREHEAD_TOP][1] - browY) / faceHeight),
  };
}

/**
 * 判定のしきい値。MediaPipe の標準顔モデル（canonical_face_model）で測った値を基準に、
 * そこから明確に外れた場合だけ特徴として扱う。
 *   標準顔: faceAspect 1.152 / eyeGap 0.242 / jawWidth 0.775
 * 人口分布での較正はしていない（分布データが無いため）。
 */
export const PHYSIOGNOMY_BASELINE = { faceAspect: 1.152, eyeGap: 0.242, jawWidth: 0.775 } as const;

export const PHYSIOGNOMY_THRESHOLDS = {
  longFace: 1.22, // 標準 +6%
  wideEyes: 0.26, // 標準 +7%
  narrowEyes: 0.225, // 標準 -7%
  strongJaw: 0.82, // 標準 +6%
} as const;

export function isValidRatios(r: Partial<FaceRatios> | null | undefined): r is FaceRatios {
  if (!r) return false;
  const inRange = (v: unknown, lo: number, hi: number) => typeof v === "number" && Number.isFinite(v) && v > lo && v < hi;
  return (
    inRange(r.faceAspect, 0.5, 2.5) &&
    inRange(r.eyeGap, 0.05, 0.6) &&
    inRange(r.jawWidth, 0.3, 1.2) &&
    inRange(r.foreheadRatio, 0, 1)
  );
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;
