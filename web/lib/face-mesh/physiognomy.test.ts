import assert from "node:assert/strict";
import { test } from "node:test";
import { register } from "./canonical.ts";
import type { FaceData, Vec3 } from "./geometry.ts";
import { PHYSIOGNOMY_BASELINE, PHYSIOGNOMY_THRESHOLDS, isValidRatios, physiognomyRatios } from "./physiognomy.ts";

/**
 * MediaPipe canonical_face_model.obj（Apache-2.0）の頂点のうち、計測と姿勢補正に使う点だけ。
 * 単位は cm、x右・y上・z手前。
 */
const CANONICAL: Array<[number, Vec3]> = [
  [2, [0.0, -2.089024, 6.058267]],
  [10, [0.0, 8.261778, 4.481535]],
  [33, [-4.445859, 2.663991, 3.173422]],
  [105, [-3.986562, 5.109487, 4.466315]],
  [133, [-1.856432, 2.585245, 3.757904]],
  [152, [0.0, -9.403378, 4.264492]],
  [168, [0.0, 3.271027, 5.236015]],
  [172, [-5.940524, -6.223629, -0.631468]],
  [234, [-7.664182, 0.673132, -2.435867]],
  [263, [4.445859, 2.663991, 3.173422]],
  [334, [3.986562, 5.109487, 4.466315]],
  [362, [1.856432, 2.585245, 3.757904]],
  [397, [5.940524, -6.223629, -0.631468]],
  [454, [7.664182, 0.673132, -2.435867]],
];

function canonicalPoints(): Vec3[] {
  const pts: Vec3[] = Array.from({ length: 478 }, () => [0, 0, 0] as Vec3);
  for (const [i, p] of CANONICAL) pts[i] = p;
  return pts;
}

/** canonical 顔を回転・拡大・移動し、画像のピクセル座標（y下・z奥）に置く */
function toImage(points: Vec3[], yawDeg: number, rollDeg: number, s = 20, ox = 450, oy = 450): FaceData {
  const y = (yawDeg * Math.PI) / 180;
  const r = (rollDeg * Math.PI) / 180;
  const pts = points.map(([x0, y0, z0]): Vec3 => {
    // yaw（y軸回り）→ roll（z軸回り）
    const x1 = x0 * Math.cos(y) + z0 * Math.sin(y);
    const z1 = -x0 * Math.sin(y) + z0 * Math.cos(y);
    const x2 = x1 * Math.cos(r) - y0 * Math.sin(r);
    const y2 = x1 * Math.sin(r) + y0 * Math.cos(r);
    return [ox + x2 * s, oy - y2 * s, -z1 * s];
  });
  return { width: 900, height: 900, points: pts, edges: [] };
}

test("標準顔モデルでは基準値どおりの比率になる", () => {
  const r = physiognomyRatios(canonicalPoints());
  assert.ok(Math.abs(r.faceAspect - PHYSIOGNOMY_BASELINE.faceAspect) < 0.002, `faceAspect ${r.faceAspect}`);
  assert.ok(Math.abs(r.eyeGap - PHYSIOGNOMY_BASELINE.eyeGap) < 0.002, `eyeGap ${r.eyeGap}`);
  assert.ok(Math.abs(r.jawWidth - PHYSIOGNOMY_BASELINE.jawWidth) < 0.002, `jawWidth ${r.jawWidth}`);
  assert.ok(isValidRatios(r));
});

test("標準顔はどの特徴にも当てはまらない（しきい値が標準から外れている）", () => {
  const b = PHYSIOGNOMY_BASELINE;
  const t = PHYSIOGNOMY_THRESHOLDS;
  assert.ok(b.faceAspect < t.longFace);
  assert.ok(b.eyeGap < t.wideEyes && b.eyeGap > t.narrowEyes);
  assert.ok(b.jawWidth < t.strongJaw);
});

test("同じ入力なら必ず同じ値（乱数を使わない）", () => {
  const face = toImage(canonicalPoints(), 0, 0);
  const a = physiognomyRatios(register(face, null, "landmarks").points);
  const b = physiognomyRatios(register(face, null, "landmarks").points);
  assert.deepEqual(a, b);
});

test("顔の傾き（roll）・拡大・位置が変わっても比率はほぼ変わらない", () => {
  const front = physiognomyRatios(register(toImage(canonicalPoints(), 0, 0), null, "landmarks").points);
  const tilted = physiognomyRatios(
    register(toImage(canonicalPoints(), 0, 15, 35, 300, 520), null, "landmarks").points,
  );
  for (const k of ["faceAspect", "eyeGap", "jawWidth"] as const) {
    assert.ok(Math.abs(front[k] - tilted[k]) / front[k] < 0.01, `${k}: ${front[k]} vs ${tilted[k]}`);
  }
});

test("横向き（yaw 20°）でも姿勢補正で誤差 3% 以内", () => {
  const front = physiognomyRatios(register(toImage(canonicalPoints(), 0, 0), null, "landmarks").points);
  const turned = physiognomyRatios(register(toImage(canonicalPoints(), 20, 0), null, "landmarks").points);
  for (const k of ["faceAspect", "eyeGap", "jawWidth"] as const) {
    assert.ok(Math.abs(front[k] - turned[k]) / front[k] < 0.03, `${k}: ${front[k]} vs ${turned[k]}`);
  }
});

test("不正な値は受け付けない", () => {
  assert.equal(isValidRatios(null), false);
  assert.equal(isValidRatios({ faceAspect: 1.1, eyeGap: Number.NaN, jawWidth: 0.8, foreheadRatio: 0.2 }), false);
  assert.equal(isValidRatios({ faceAspect: 1.1, eyeGap: 0.24, jawWidth: 0.8 }), false);
});
