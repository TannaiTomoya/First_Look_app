"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Button, Card } from "@/components/ui";
import { fileToCanvas } from "@/lib/face-tools";
import {
  buildImageMesh,
  deformJaw,
  headFrame,
  jawCrop,
  jawWeights,
  legacyMetrics,
  matchLegacyStrength,
  meshMetrics,
  meshPositions,
  poseStability,
  renderLegacy,
  rotateFaceYaw,
  type Crop,
  type DeformMetrics,
  type FaceData,
  type HeadFrame,
  type PoseStability,
} from "@/lib/face-mesh/geometry";
import { MorphCanvas } from "@/components/future-face/morph-view";
import { SHAPE_TOLERANCE_PT, measureShapeImage, shapeModel, solveShape } from "@/lib/face-mesh/future-face";
import { detectFace, loadFaceLandmarker, type Detection } from "@/lib/face-mesh/landmarker";
import { StructureTrend } from "@/components/structure-trend";
import { MeasurementNotice } from "@/components/measurement-notice";
import { toDaySeries, type SnapshotPoint } from "@/lib/face-mesh/trend";
import {
  REGISTRATION_TOLERANCE_PCT,
  maxRelativeDiffPct,
  naiveMetrics,
  qualityIssues,
  register,
  type Pose,
  type StructureMetrics,
} from "@/lib/face-mesh/canonical";

/** スライダー強度 0〜60 → 顎幅の縮小率 0〜15% */
const strengthToScale = (strength: number) => strength / 400;

type Status = "idle" | "loading" | "ready" | "noface" | "error";

export default function FaceMeshLab() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<HTMLCanvasElement | null>(null);
  const [det, setDet] = useState<Detection | null>(null);
  const [strength, setStrength] = useState(40);
  const [yaw, setYaw] = useState(25);
  const [spin, setSpin] = useState(false);
  const [showWire, setShowWire] = useState(true);
  const [zoomJaw, setZoomJaw] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  async function run(file: File) {
    setStatus("loading");
    setError(null);
    setDet(null);
    try {
      const canvas = await fileToCanvas(file, 900);
      setSource(canvas);
      const d = await detectFace(canvas);
      if (!d) {
        setStatus("noface");
        return;
      }
      setDet(d);
      setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "解析に失敗しました");
      setStatus("error");
    }
  }

  useEffect(() => {
    void loadFaceLandmarker().catch(() => undefined);
  }, []);

  const face = det?.face ?? null;
  const frame = useMemo(() => (face ? headFrame(face.points) : null), [face]);
  const weights = useMemo(() => (face && frame ? jawWeights(face, frame) : null), [face, frame]);
  const mesh = useMemo(() => (face ? buildImageMesh(face) : null), [face]);
  const crop = useMemo(() => (face ? jawCrop(face) : null), [face]);
  const s = strengthToScale(strength);
  const deformed = useMemo(
    () => (face && frame && weights ? deformJaw(face, frame, weights, s) : null),
    [face, frame, weights, s],
  );
  const positions = useMemo(
    () => (mesh && deformed ? meshPositions(mesh, deformed) : null),
    [mesh, deformed],
  );

  const comparison = useMemo(() => {
    if (!face || !frame || !deformed || !mesh) return null;
    const meshM = meshMetrics(face, frame, deformed, mesh);
    const match = matchLegacyStrength(face, frame, meshM.jawWidthChangePct);
    const legacyM = legacyMetrics(face, frame, match.strength01);
    const legacyMinPct = legacyMetrics(face, frame, 0).jawWidthChangePct;
    const pose = poseStability(face, frame, s, match.strength01);
    return { meshM, legacyM, match, legacyMinPct, pose };
  }, [face, frame, deformed, mesh, s]);

  const legacyUrl = useMemo(() => {
    if (!source || !face || !comparison) return null;
    const ctx = source.getContext("2d");
    if (!ctx) return null;
    const out = renderLegacy(ctx.getImageData(0, 0, source.width, source.height), face, comparison.match.strength01);
    const c = document.createElement("canvas");
    c.width = out.width;
    c.height = out.height;
    c.getContext("2d")!.putImageData(out, 0, 0);
    return c.toDataURL("image/jpeg", 0.9);
  }, [source, face, comparison]);

  const originalUrl = useMemo(() => source?.toDataURL("image/jpeg", 0.9) ?? null, [source]);
  const topBlend = useMemo(
    () => [...(det?.blendshapes ?? [])].sort((a, b) => b.score - a.score).slice(0, 5),
    [det],
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-xs font-semibold tracking-wide text-brand">LAB · FACE MESH PoC</p>
      <h1 className="mt-1 font-display text-3xl font-semibold">顔メッシュ PoC</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        顔を画像ではなく 478 点の3D点群として扱い、顎の頂点だけを顔の座標系で動かします。画像と点群は端末内で処理し、サーバーへ送信しません（認識モデルのみ CDN から取得）。
      </p>
      <MeasurementNotice className="mt-2 max-w-3xl" />

      <Card className="mt-6">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => inputRef.current?.click()} disabled={status === "loading"}>
            写真を選ぶ
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void run(f);
              e.target.value = "";
            }}
          />
          <span className="text-sm text-muted">
            {status === "loading" && "モデル読み込み・検出中..."}
            {status === "noface" && "顔を検出できませんでした。正面寄りの写真で試してください。"}
            {status === "error" && error}
            {status === "ready" && face && `検出: ${face.points.length} 点 / 三角形メッシュ ${face.edges.length} 辺`}
          </span>
        </div>
      </Card>

      {status === "ready" && face && det && frame && mesh && positions && deformed && comparison && source && (
        <>
          <section className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <Card>
              <h2 className="font-semibold">① 478点の3D点群（#2）</h2>
              <div className="mt-3 aspect-square w-full overflow-hidden rounded-2xl bg-[#120d1c]">
                <Canvas camera={{ position: [0, 0, 4.8], fov: 40 }} flat>
                  <PointCloud face={face} yaw={yaw} spin={spin} />
                </Canvas>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                <label className="flex items-center gap-2">
                  回転 {yaw}°
                  <input type="range" min={-80} max={80} value={yaw} onChange={(e) => setYaw(Number(e.target.value))} />
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={spin} onChange={(e) => setSpin(e.target.checked)} />
                  自動回転
                </label>
              </div>
            </Card>
            <Card>
              <h2 className="font-semibold">取得データ</h2>
              <ul className="mt-3 space-y-1 text-sm text-muted">
                <li>ランドマーク: {face.points.length} 点（x, y, z）</li>
                <li>Blendshapes: {det.blendshapes.length} 種</li>
                <li>Transformation Matrix: {det.matrix ? "4×4 取得済み" : "なし"}</li>
              </ul>
              <p className="mt-4 text-xs font-semibold text-brand">表情 上位5</p>
              <ul className="mt-1 space-y-1 text-xs text-muted">
                {topBlend.map((b) => (
                  <li key={b.name} className="flex justify-between gap-3">
                    <span>{b.name}</span>
                    <span>{b.score.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
              {det.matrix && (
                <>
                  <p className="mt-4 text-xs font-semibold text-brand">Matrix（raw）</p>
                  <div className="mt-1 grid grid-cols-4 gap-1 font-mono text-[10px] text-muted">
                    {det.matrix.map((v, i) => (
                      <span key={i}>{v.toFixed(2)}</span>
                    ))}
                  </div>
                </>
              )}
            </Card>
          </section>

          <section className="mt-6">
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-semibold">② 顎の頂点だけを Morph（#3）</h2>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    強度 {strength}%
                    <input
                      type="range"
                      min={0}
                      max={60}
                      value={strength}
                      onChange={(e) => setStrength(Number(e.target.value))}
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={showWire} onChange={(e) => setShowWire(e.target.checked)} />
                    メッシュ表示
                  </label>
                </div>
              </div>
              <p className="mt-1 text-xs text-muted">
                顎幅 {comparison.meshM.jawWidthChangePct.toFixed(1)}% · 鼻・目・口の頂点は固定 · 反転三角形{" "}
                {comparison.meshM.flippedTriangles}
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <figure>
                  <img src={originalUrl ?? ""} alt="元画像" className="w-full rounded-2xl" />
                  <figcaption className="mt-1 text-xs text-muted">元画像</figcaption>
                </figure>
                <figure>
                  <MorphCanvas source={source} mesh={mesh} positions={positions} face={face} deformedFace={deformed} showWire={showWire} />
                  <figcaption className="mt-1 text-xs text-muted">メッシュ変形（元画像をテクスチャとして貼付）</figcaption>
                </figure>
              </div>
            </Card>
          </section>

          <section className="mt-6">
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-semibold">③ 2Dワープ（旧方式）との比較（#4）</h2>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={zoomJaw} onChange={(e) => setZoomJaw(e.target.checked)} />
                  顎まわりを拡大
                </label>
              </div>
              <p className="mt-1 text-xs text-muted">
                旧 static/js/future_face.js の slimJaw を移植し、顎幅の変化率が同じになる強度に揃えて比較しています
                {comparison.match.reachable
                  ? `（旧方式の強度 ${(comparison.match.strength01 * 100).toFixed(0)}）`
                  : "（旧方式では同じ変化率に届かないため、範囲の端の強度で表示）"}
                。旧方式は強度0でも顎幅 {comparison.legacyMinPct.toFixed(1)}% になり、これより弱い変化は作れません。
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <figure>
                  <CroppedImage src={originalUrl} alt="元画像" W={source.width} H={source.height} crop={zoomJaw ? crop : null} />
                  <figcaption className="mt-1 text-xs text-muted">元画像</figcaption>
                </figure>
                <figure>
                  <CroppedImage src={legacyUrl} alt="旧2Dワープ" W={source.width} H={source.height} crop={zoomJaw ? crop : null} />
                  <figcaption className="mt-1 text-xs text-muted">
                    旧2Dワープ（顎幅 {comparison.legacyM.jawWidthChangePct.toFixed(1)}%）
                  </figcaption>
                </figure>
                <figure>
                  <MorphCanvas
                    source={source}
                    mesh={mesh}
                    positions={positions}
                    face={face}
                    deformedFace={deformed}
                    showWire={false}
                    crop={zoomJaw ? crop : null}
                  />
                  <figcaption className="mt-1 text-xs text-muted">
                    メッシュ（顎幅 {comparison.meshM.jawWidthChangePct.toFixed(1)}%）
                  </figcaption>
                </figure>
              </div>
              <MetricsTable legacy={comparison.legacyM} mesh={comparison.meshM} pose={comparison.pose} />
            </Card>
          </section>

          <RegistrationSection det={det} frame={frame} />
          <TrendPreview det={det} />
          <ParamAccuracySection det={det} />
        </>
      )}
    </div>
  );
}

function PointCloud({ face, yaw, spin }: { face: FaceData; yaw: number; spin: boolean }) {
  const group = useRef<THREE.Group>(null);
  const { points, lines } = useMemo(() => {
    const n = face.points.length;
    let cx = 0;
    let cy = 0;
    let cz = 0;
    let minX = Infinity;
    let maxX = -Infinity;
    for (const [x, y, z] of face.points) {
      cx += x;
      cy += y;
      cz += z;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }
    cx /= n;
    cy /= n;
    cz /= n;
    const k = 2 / (maxX - minX || 1);
    const to = (p: number[]) => [(p[0] - cx) * k, -(p[1] - cy) * k, -(p[2] - cz) * k];
    const pts = new Float32Array(n * 3);
    face.points.forEach((p, i) => pts.set(to(p), i * 3));
    const ln = new Float32Array(face.edges.length * 6);
    face.edges.forEach(([a, b], i) => {
      ln.set(to(face.points[a]), i * 6);
      ln.set(to(face.points[b]), i * 6 + 3);
    });
    return { points: pts, lines: ln };
  }, [face]);

  useFrame((_, dt) => {
    if (!group.current) return;
    if (spin) group.current.rotation.y += dt * 0.6;
    else group.current.rotation.y = (yaw * Math.PI) / 180;
  });

  return (
    <group ref={group}>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[lines, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#818cf8" transparent opacity={0.45} />
      </lineSegments>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[points, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#e0e7ff" size={0.018} sizeAttenuation />
      </points>
    </group>
  );
}

function CroppedImage({
  src,
  alt,
  W,
  H,
  crop,
}: {
  src: string | null;
  alt: string;
  W: number;
  H: number;
  crop: Crop | null;
}) {
  const c = crop ?? { x: 0, y: 0, w: W, h: H };
  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-zinc-100" style={{ aspectRatio: `${c.w} / ${c.h}` }}>
      {src && (
        <img
          src={src}
          alt={alt}
          className="absolute max-w-none"
          style={{
            width: `${(W / c.w) * 100}%`,
            left: `${(-c.x / c.w) * 100}%`,
            top: `${(-c.y / c.h) * 100}%`,
          }}
        />
      )}
    </div>
  );
}

function MetricsTable({
  legacy,
  mesh,
  pose,
}: {
  legacy: DeformMetrics;
  mesh: DeformMetrics;
  pose: PoseStability;
}) {
  const spread = (v: number[]) => Math.max(...v) - Math.min(...v);
  const rows: Array<{
    label: string;
    note: string;
    l: number;
    m: number;
    fmt: (v: number) => string;
    better: "low" | "high";
  }> = [
    { label: "左右対称性", note: "1.00 = 完全対称", l: legacy.symmetry, m: mesh.symmetry, fmt: (v) => v.toFixed(2), better: "high" },
    { label: "鼻・目・口の移動", note: "px · 小さいほど良い", l: legacy.protectedShiftPx, m: mesh.protectedShiftPx, fmt: (v) => v.toFixed(2), better: "low" },
    { label: "上顔部への漏れ", note: "鼻先より上 · px", l: legacy.upperLeakPx, m: mesh.upperLeakPx, fmt: (v) => v.toFixed(2), better: "low" },
    { label: "輪郭の波打ち", note: "移動量の二階差分 RMS · px", l: legacy.contourRoughnessPx, m: mesh.contourRoughnessPx, fmt: (v) => v.toFixed(2), better: "low" },
    {
      label: "姿勢±15°での顎幅ブレ",
      note: "同じ設定での変化率の幅 · pt",
      l: spread(pose.legacy.jawPct),
      m: spread(pose.mesh.jawPct),
      fmt: (v) => v.toFixed(2),
      better: "low",
    },
    {
      label: "姿勢±15°での最小対称性",
      note: "1.00 = 完全対称",
      l: Math.min(...pose.legacy.symmetry),
      m: Math.min(...pose.mesh.symmetry),
      fmt: (v) => v.toFixed(2),
      better: "high",
    },
  ];
  const wins = rows.filter((r) => (r.better === "low" ? r.m < r.l - 1e-3 : r.m > r.l + 1e-3)).length;
  const flipsOk = (mesh.flippedTriangles ?? 0) === 0;

  return (
    <div className="mt-5">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="py-2 pr-3 font-medium">指標</th>
              <th className="py-2 pr-3 font-medium">旧2Dワープ</th>
              <th className="py-2 pr-3 font-medium">メッシュ</th>
              <th className="py-2 font-medium">優位</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const meshWins = r.better === "low" ? r.m < r.l - 1e-3 : r.m > r.l + 1e-3;
              const tie = Math.abs(r.m - r.l) <= 1e-3;
              return (
                <tr key={r.label} className="border-b border-line/60">
                  <td className="py-2 pr-3">
                    {r.label}
                    <span className="ml-2 text-xs text-muted">{r.note}</span>
                  </td>
                  <td className="py-2 pr-3 font-mono">{r.fmt(r.l)}</td>
                  <td className="py-2 pr-3 font-mono">{r.fmt(r.m)}</td>
                  <td className="py-2 text-xs">{tie ? "同等" : meshWins ? "メッシュ" : "旧方式"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm">
        メッシュ優位 <span className="font-semibold">{wins}/{rows.length}</span> 指標 · 反転三角形{" "}
        {mesh.flippedTriangles ?? 0}
        {wins >= Math.ceil(rows.length * 0.66) && flipsOk ? "（Go 候補）" : "（要検討）"}
      </p>
      <p className="mt-1 text-xs text-muted">
        姿勢の行は、検出した3D点群を顔の縦軸まわりに ±15° 回転させた擬似入力で計算しています（画像は回転させていません）。数値は判断材料で、Go/No-Go は見た目の比較と合わせて人が判断します。
      </p>
    </div>
  );
}

/** /progress の表示確認用。今の写真の指標を起点に、顎幅 -3%/90日 の傾向とノイズを加えたダミー */
function TrendPreview({ det }: { det: Detection }) {
  const { series, total } = useMemo(() => {
    const m = register(det.face, det.matrix).metrics;
    let seed = 7;
    const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.03;
    const t0 = Date.UTC(2026, 7, 1);
    const rows: SnapshotPoint[] = [0, 2, 5, 7, 12, 18, 25, 31, 40, 52, 63, 75, 88, 91].map((d) => ({
      captured_at: new Date(t0 + d * 86400000).toISOString(),
      jaw_ratio: m.jawRatio * (1 - 0.03 * (d / 90)) * (1 + noise()),
      cheek_width: m.cheekWidth * (1 - 0.02 * (d / 90)) * (1 + noise()),
      face_aspect: m.faceAspect * (1 + noise()),
      quality_ok: d !== 40,
      model_version: "preview",
    }));
    return { series: toDaySeries(rows), total: rows.length };
  }, [det]);
  return (
    <section className="mt-6">
      <p className="text-xs font-semibold text-brand">⑤ /progress の表示プレビュー（#7・ダミーデータ）</p>
      <StructureTrend series={series} total={total} />
    </section>
  );
}

const ACCURACY_TARGETS: Array<[number, number]> = [
  [-3, 0],
  [-6, 0],
  [-12, 0],
  [-15, 0],
  [0, -3],
  [0, -6],
  [0, -10],
  [-5, 0],
  [-12, -6],
  [-15, -10],
];

/** Future Face の形状パラメータ（目標 %）と、変形後に実測した % の差（#8 の完了条件） */
function ParamAccuracySection({ det }: { det: Detection }) {
  const rows = useMemo(() => {
    const model = shapeModel(det.face, det.matrix);
    return ACCURACY_TARGETS.map(([contour, cheek]) => {
      const r = solveShape(model, contour, cheek);
      const image = measureShapeImage(model, r.points);
      const diff = Math.max(Math.abs(r.measured.contourPct - contour), Math.abs(r.measured.cheekPct - cheek));
      return { contour, cheek, r, image, diff };
    });
  }, [det]);
  const fmt = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
  return (
    <section className="mt-6">
      <Card>
        <h2 className="font-semibold">⑥ Future Face：パラメータと実測の一致（#8）</h2>
        <p className="mt-1 text-xs text-muted">
          目標の変化率になるよう変形強度を自動で補正し、変形後の顔を姿勢補正した座標で測り直しています。許容 ±{SHAPE_TOLERANCE_PT}pt。「画像上」は写真の見た目での変化率（参考）。
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="py-2 pr-3 font-medium">目標 輪郭 / 頬</th>
                <th className="py-2 pr-3 font-medium">実測 輪郭 / 頬</th>
                <th className="py-2 pr-3 font-medium">画像上 輪郭 / 頬</th>
                <th className="py-2 pr-3 font-medium">最大差</th>
                <th className="py-2 pr-3 font-medium">反転三角形</th>
                <th className="py-2 font-medium">判定</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ contour, cheek, r, image, diff }) => (
                <tr key={`${contour}/${cheek}`} className="border-b border-line/60 font-mono">
                  <td className="py-2 pr-3">
                    {fmt(contour)} / {fmt(cheek)}
                  </td>
                  <td className="py-2 pr-3">
                    {fmt(r.measured.contourPct)} / {fmt(r.measured.cheekPct)}
                  </td>
                  <td className="py-2 pr-3 text-muted">
                    {fmt(image.contourPct)} / {fmt(image.cheekPct)}
                  </td>
                  <td className="py-2 pr-3">{diff.toFixed(2)}pt</td>
                  <td className="py-2 pr-3">{r.flipped}</td>
                  <td className="py-2 font-sans text-xs">
                    {!r.reachable ? "範囲外" : diff <= SHAPE_TOLERANCE_PT && r.flipped === 0 ? "一致" : "要確認"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}

const SYNTH_YAWS = [-25, -15, 0, 15, 25];
const jawOpenOf = (d: Detection) => d.blendshapes.find((b) => b.name === "jawOpen")?.score ?? 0;
const fmtPose = (p: Pose) => `yaw ${p.yaw.toFixed(1)}° · pitch ${p.pitch.toFixed(1)}° · roll ${p.roll.toFixed(1)}°`;

function RegistrationSection({ det, frame }: { det: Detection; frame: HeadFrame }) {
  const [second, setSecond] = useState<Detection | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "noface">("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  const regM = useMemo(() => register(det.face, det.matrix, "matrix"), [det]);
  const regL = useMemo(() => register(det.face, null, "landmarks"), [det]);

  const synth = useMemo(() => {
    const rows = SYNTH_YAWS.map((y) => {
      const f = rotateFaceYaw(det.face, frame, y);
      return { yaw: y, naive: naiveMetrics(f), canon: register(f, null, "landmarks").metrics };
    });
    const base = rows.find((r) => r.yaw === 0)!;
    return rows.map((r) => ({
      ...r,
      naiveDiff: maxRelativeDiffPct(base.naive, r.naive),
      canonDiff: maxRelativeDiffPct(base.canon, r.canon),
    }));
  }, [det, frame]);

  const pair = useMemo(() => {
    if (!second) return null;
    const rows: Array<{ label: string; a: StructureMetrics; b: StructureMetrics }> = [
      { label: "Registration（matrix）", a: regM.metrics, b: register(second.face, second.matrix, "matrix").metrics },
      { label: "Registration（剛体ランドマーク）", a: regL.metrics, b: register(second.face, null, "landmarks").metrics },
      { label: "補正なし（画像平面）", a: naiveMetrics(det.face), b: naiveMetrics(second.face) },
    ];
    return {
      pose: register(second.face, second.matrix, "matrix").pose,
      issues: qualityIssues(register(second.face, second.matrix, "matrix").pose, jawOpenOf(second)),
      rows: rows.map((r) => ({ ...r, diff: maxRelativeDiffPct(r.a, r.b) })),
    };
  }, [second, det, regM, regL]);

  async function runSecond(file: File) {
    setState("loading");
    setSecond(null);
    const canvas = await fileToCanvas(file, 900);
    const d = await detectFace(canvas);
    setSecond(d);
    setState(d ? "idle" : "noface");
  }

  const issues = qualityIssues(regM.pose, jawOpenOf(det));

  return (
    <section className="mt-6">
      <Card>
        <h2 className="font-semibold">④ Canonical Face への正規化（#5）</h2>
        <p className="mt-1 text-xs text-muted">
          姿勢を取り除いた座標で、外眼角間距離を 1 として構造指標を出します。同一人物なら角度が違っても値がそろうのが目標（許容 {REGISTRATION_TOLERANCE_PCT}%）。
        </p>
        <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
          <p>
            <span className="text-xs text-muted">姿勢（matrix）</span>
            <br />
            <span className="font-mono text-xs">{fmtPose(regM.pose)}</span>
          </p>
          <p>
            <span className="text-xs text-muted">姿勢（剛体ランドマーク）</span>
            <br />
            <span className="font-mono text-xs">{fmtPose(regL.pose)}</span>
          </p>
        </div>
        <p className="mt-2 text-sm">
          構造指標: 顎幅/頬幅 <span className="font-mono">{regM.metrics.jawRatio.toFixed(3)}</span> · 頬幅{" "}
          <span className="font-mono">{regM.metrics.cheekWidth.toFixed(3)}</span> · 縦横比{" "}
          <span className="font-mono">{regM.metrics.faceAspect.toFixed(3)}</span>
          {issues.length > 0 && <span className="ml-2 text-xs text-accent">参考値（{issues.join("・")}）</span>}
        </p>

        <h3 className="mt-5 text-sm font-semibold">擬似回転での安定性</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="py-2 pr-3 font-medium">回転</th>
                <th className="py-2 pr-3 font-medium">補正なし 顎幅/頬幅</th>
                <th className="py-2 pr-3 font-medium">正規化 顎幅/頬幅</th>
                <th className="py-2 pr-3 font-medium">補正なし 最大差</th>
                <th className="py-2 font-medium">正規化 最大差</th>
              </tr>
            </thead>
            <tbody>
              {synth.map((r) => (
                <tr key={r.yaw} className="border-b border-line/60 font-mono">
                  <td className="py-2 pr-3">{r.yaw}°</td>
                  <td className="py-2 pr-3">{r.naive.jawRatio.toFixed(3)}</td>
                  <td className="py-2 pr-3">{r.canon.jawRatio.toFixed(3)}</td>
                  <td className="py-2 pr-3">{r.naiveDiff.toFixed(1)}%</td>
                  <td className="py-2">{r.canonDiff.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="mt-5 text-sm font-semibold">同一人物・角度違いの2枚目で検証（完了条件）</h3>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={state === "loading"}>
            2枚目を選ぶ
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void runSecond(f);
              e.target.value = "";
            }}
          />
          <span className="text-sm text-muted">
            {state === "loading" && "検出中..."}
            {state === "noface" && "顔を検出できませんでした"}
            {pair && `2枚目の姿勢: ${fmtPose(pair.pose)}`}
          </span>
        </div>
        {pair && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="py-2 pr-3 font-medium">方式</th>
                  <th className="py-2 pr-3 font-medium">顎幅/頬幅 1枚目 → 2枚目</th>
                  <th className="py-2 pr-3 font-medium">最大差</th>
                  <th className="py-2 font-medium">判定</th>
                </tr>
              </thead>
              <tbody>
                {pair.rows.map((r) => (
                  <tr key={r.label} className="border-b border-line/60">
                    <td className="py-2 pr-3">{r.label}</td>
                    <td className="py-2 pr-3 font-mono">
                      {r.a.jawRatio.toFixed(3)} → {r.b.jawRatio.toFixed(3)}
                    </td>
                    <td className="py-2 pr-3 font-mono">{r.diff.toFixed(1)}%</td>
                    <td className="py-2 text-xs">{r.diff <= REGISTRATION_TOLERANCE_PCT ? "許容内" : "超過"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pair.issues.length > 0 && (
              <p className="mt-2 text-xs text-accent">2枚目は参考値: {pair.issues.join("・")}</p>
            )}
          </div>
        )}
      </Card>
    </section>
  );
}
