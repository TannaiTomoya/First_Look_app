"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { CheckoutButton } from "@/components/checkout-button";
import { MorphCanvas } from "@/components/future-face/morph-view";
import { MeasurementNotice } from "@/components/measurement-notice";
import { Button, Card } from "@/components/ui";
import { fileToCanvas } from "@/lib/face-tools";
import { qualityIssues, register } from "@/lib/face-mesh/canonical";
import {
  PARAM_SPECS,
  SHAPE_TOLERANCE_PT,
  STAGES,
  paramsForStage,
  shapeModel,
  solveShape,
  type FutureParams,
  type Stage,
} from "@/lib/face-mesh/future-face";
import { faceCrop } from "@/lib/face-mesh/geometry";
import { detectFace, loadFaceLandmarker, type Detection } from "@/lib/face-mesh/landmarker";
import { foldShadow, prepareSkin, renderSkin, skinMetrics } from "@/lib/face-mesh/skin";
import { clampParams, type FutureFaceAccess } from "@/lib/future-face/access";

type Status = "idle" | "loading" | "ready" | "noface" | "error";

const fmtPct = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;

export default function FutureFaceClient({
  access,
  upgradeMessage,
}: {
  access: FutureFaceAccess;
  upgradeMessage: string | null;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<HTMLCanvasElement | null>(null);
  const [det, setDet] = useState<Detection | null>(null);
  const [params, setParams] = useState<FutureParams>(access.preset);
  const [stage, setStage] = useState<Stage>("target");
  const [zoom, setZoom] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadFaceLandmarker().catch(() => undefined);
  }, []);

  async function run(file: File) {
    setStatus("loading");
    setError(null);
    setDet(null);
    try {
      const canvas = await fileToCanvas(file, 900);
      const d = await detectFace(canvas);
      setSource(canvas);
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

  const deferred = useDeferredValue(params);
  const effective = useMemo(() => clampParams(access, deferred), [access, deferred]);
  const shown = useMemo(() => paramsForStage(effective, stage), [effective, stage]);
  const { contourPct, cheekPct, clarity, nasolabial } = shown;

  const model = useMemo(() => (det ? shapeModel(det.face, det.matrix) : null), [det]);
  const crop = useMemo(() => (det ? faceCrop(det.face) : null), [det]);
  const prep = useMemo(() => (source && det ? prepareSkin(source, det.face.points) : null), [source, det]);
  const shape = useMemo(
    () => (model ? solveShape(model, contourPct, cheekPct) : null),
    [model, contourPct, cheekPct],
  );
  const skinCanvas = useMemo(() => {
    if (!prep || !source) return null;
    if (!clarity && !nasolabial) return source;
    return renderSkin(prep, clarity, nasolabial);
  }, [prep, source, clarity, nasolabial]);

  const skinBefore = useMemo(
    () => (prep && source ? { ...skinMetrics(prep, source), fold: foldShadow(prep, source) } : null),
    [prep, source],
  );
  const skinAfter = useMemo(
    () => (prep && skinCanvas ? { ...skinMetrics(prep, skinCanvas), fold: foldShadow(prep, skinCanvas) } : null),
    [prep, skinCanvas],
  );
  const issues = useMemo(() => {
    if (!det) return [];
    const jawOpen = det.blendshapes.find((b) => b.name === "jawOpen")?.score ?? 0;
    return qualityIssues(register(det.face, det.matrix).pose, jawOpen);
  }, [det]);

  const setParam = (key: keyof FutureParams, v: number) => setParams((p) => ({ ...p, [key]: v }));
  return (
    <div>
      <p className="text-sm text-muted">3D シミュレーション</p>
      <h1 className="mt-1 font-display text-3xl font-semibold">Future Face</h1>
      <p className="mt-2 text-sm text-muted">
        輪郭・頬は顔の3D点群を動かし、肌は画像処理で表現します。写真は端末内で処理し、サーバーへ送信しません。
      </p>

      <Card className="mt-6">
        <div className="flex flex-wrap items-center gap-3">
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
            {status === "idle" && "正面・無表情・明るい場所の写真がおすすめです。"}
            {status === "loading" && "モデル読み込み・検出中..."}
            {status === "noface" && "顔を検出できませんでした。正面寄りの写真で試してください。"}
            {status === "error" && error}
            {status === "ready" && issues.length > 0 && `参考表示（${issues.join("・")}）`}
          </span>
        </div>
      </Card>

      {status === "ready" && det && model && shape && skinCanvas && (
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <Card>
            <div className="flex flex-wrap gap-2" role="tablist">
              {STAGES.map((s) => (
                <Button
                  key={s.key}
                  type="button"
                  role="tab"
                  aria-selected={stage === s.key}
                  variant={stage === s.key ? "primary" : "outline"}
                  onClick={() => setStage(s.key)}
                >
                  {s.label}
                </Button>
              ))}
            </div>
            <div className="mt-4">
              <MorphCanvas
                source={skinCanvas}
                mesh={model.mesh}
                positions={shape.positions}
                face={det.face}
                deformedFace={shape.points}
                showWire={false}
                crop={zoom ? crop : null}
              />
            </div>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={zoom} onChange={(e) => setZoom(e.target.checked)} />
              顔を拡大
            </label>
            <p className="mt-2 text-xs text-muted">
              Original = 元の写真 / Slim = 輪郭・頬のみ / Skin = 肌のみ / Target = すべて
            </p>
          </Card>

          <Card>
            <h2 className="font-semibold">パラメータ</h2>
            <div className="mt-4 space-y-5">
              {PARAM_SPECS.map((spec) => {
                const target = effective[spec.key];
                const isShape = spec.key === "contourPct" || spec.key === "cheekPct";
                const measured = isShape ? shape.measured[spec.key as "contourPct" | "cheekPct"] : null;
                const active = isShape ? stage === "slim" || stage === "target" : stage === "skin" || stage === "target";
                return (
                  <label key={spec.key} className="block">
                    <div className="flex items-baseline justify-between text-sm">
                      <span>{spec.label}</span>
                      <span className="font-mono">
                        {isShape ? fmtPct(target) : target}
                      </span>
                    </div>
                    <input
                      type="range"
                      className="mt-1 w-full"
                      min={spec.min}
                      max={spec.max}
                      step={spec.step}
                      value={access.fullParams ? params[spec.key] : target}
                      disabled={!access.fullParams}
                      onChange={(e) => setParam(spec.key, Number(e.target.value))}
                    />
                    {isShape && measured !== null && (
                      <p className="mt-1 text-xs text-muted">
                        {active ? (
                          <>
                            実測 {fmtPct(measured)}
                            {Math.abs(measured - shown[spec.key]) > SHAPE_TOLERANCE_PT && "（範囲外のため近い値で表示）"}
                          </>
                        ) : (
                          "この段階では適用していません"
                        )}
                      </p>
                    )}
                    {spec.key === "clarity" && skinBefore && skinAfter && (
                      <p className="mt-1 text-xs text-muted">
                        {active
                          ? `肌の明るさ ${skinBefore.brightness} → ${skinAfter.brightness} · ムラ ${skinBefore.contrast} → ${skinAfter.contrast}`
                          : "この段階では適用していません"}
                      </p>
                    )}
                    {spec.key === "nasolabial" && skinBefore && skinAfter && (
                      <p className="mt-1 text-xs text-muted">
                        {active ? `影の濃さ ${skinBefore.fold} → ${skinAfter.fold}` : "この段階では適用していません"}
                      </p>
                    )}
                  </label>
                );
              })}
            </div>
            {access.fullParams ? (
              <Button type="button" variant="outline" className="mt-5" onClick={() => setParams(access.preset)}>
                プリセットに戻す
              </Button>
            ) : (
              <div className="mt-5 rounded-2xl border border-line p-4">
                <p className="text-sm">{upgradeMessage}</p>
                <div className="mt-3">
                  <CheckoutButton kind="premium_annual" label="年額で全パラメータを開放" />
                </div>
              </div>
            )}
            {shape.flipped > 0 && (
              <p className="mt-3 text-xs text-accent">変形が大きく、一部に歪みがあります。値を弱めてください。</p>
            )}
          </Card>
        </div>
      )}

      <MeasurementNotice className="mt-6" />
    </div>
  );
}
