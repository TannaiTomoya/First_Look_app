"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button, Card } from "@/components/ui";
import { CheckoutButton } from "@/components/checkout-button";
import { MeasurementNotice } from "@/components/measurement-notice";
import { isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/client";
import { getConsent, measureFile, saveSnapshot, setConsent } from "@/lib/face-mesh/snapshots";

export default function CapturePage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [consent, setConsentState] = useState<boolean | null>(null);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    getConsent(createClient())
      .then(setConsentState)
      .catch(() => setConsentState(false));
  }, []);

  async function agree() {
    try {
      await setConsent(createClient(), true);
      setConsentState(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "同意の保存に失敗しました");
    }
  }

  async function saveStructure(recordId: string | null): Promise<string> {
    if (!consent || !file) return "";
    try {
      const m = await measureFile(file);
      if (!m) return "（顔を検出できず、構造指標は保存していません）";
      await saveSnapshot(createClient(), m.row, recordId);
      return m.issues.length ? `構造指標は参考値として保存（${m.issues.join("・")}）` : "構造指標も保存しました";
    } catch {
      return "（構造指標の保存に失敗しました）";
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  function onFile(f?: File) {
    if (!f) return;
    stopCamera();
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setStatus(null);
    setError(null);
  }

  async function startCamera() {
    setError(null);
    setStatus(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "user" }, width: { ideal: 1080 }, height: { ideal: 1440 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      setPreview(null);
      setFile(null);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      setError("カメラを起動できませんでした。端末の許可を確認してください。");
    }
  }

  function takePhoto() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const next = new File([blob], `look-${Date.now()}.jpg`, { type: "image/jpeg" });
        setFile(next);
        setPreview(URL.createObjectURL(blob));
        stopCamera();
      },
      "image/jpeg",
      0.92,
    );
  }

  async function save() {
    if (!file) return;
    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("note", note);
      const res = await fetch("/api/records", { method: "POST", body });
      const data = (await res.json()) as { ok?: boolean; id?: string; error?: string };
      if (!res.ok) {
        if (res.status === 401) {
          location.href = "/login?next=/capture";
          return;
        }
        throw new Error(data.error ?? "保存に失敗しました");
      }
      const structure = await saveStructure(data.id ?? null);
      setStatus(`保存しました。記録タブで確認できます。${structure}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-semibold">今日の1枚</h1>
      <p className="mt-1 text-sm text-muted">カメラは鏡像にしません。見たままの向きで保存します。</p>

      <Card className="mt-6">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <div className="flex aspect-[3/4] w-full max-w-sm items-center justify-center overflow-hidden rounded-2xl border border-dashed border-line bg-white">
          {cameraOn ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
            />
          ) : preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="preview" className="h-full w-full object-cover" />
          ) : (
            <span className="text-sm text-muted">写真を撮るか選択</span>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {cameraOn ? (
            <>
              <Button type="button" onClick={takePhoto}>
                シャッター
              </Button>
              <Button type="button" variant="outline" onClick={stopCamera}>
                閉じる
              </Button>
            </>
          ) : (
            <>
              <Button type="button" onClick={startCamera}>
                カメラを起動
              </Button>
              <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
                アルバムから選ぶ
              </Button>
            </>
          )}
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="メモ（任意）"
          className="mt-4 w-full rounded-2xl border border-line px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand"
        />
        {consent === true && (
          <p className="mt-3 text-xs text-muted">
            顔の構造指標（顎幅・頬幅など）も記録します。停止・削除は設定から。
          </p>
        )}
        {consent === false && (
          <div className="mt-4 rounded-2xl border border-line bg-white p-4 text-sm">
            <p className="font-medium">顔の構造指標も記録しますか？（任意）</p>
            <p className="mt-1 text-xs text-muted">
              写真から顎幅・頬幅・顔の縦横比・顔の向きを数値にして保存し、変化グラフに使います。顔の検出は端末内で行い、保存するのは数値だけです（点の座標は保存しません）。本人以外は閲覧できず、設定からいつでも取り消せます。取り消すと保存済みの数値はすべて削除されます。
            </p>
            <MeasurementNotice className="mt-2" />
            <Button type="button" variant="outline" className="mt-3" onClick={agree}>
              同意して記録する
            </Button>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={save} disabled={!file || saving}>
            {saving ? "保存中..." : "記録する"}
          </Button>
          <CheckoutButton kind="future_face" label="追加パターン ¥500" variant="outline" />
        </div>
        {status && <p className="mt-3 text-sm text-brand">{status}</p>}
        {error && <p className="mt-3 text-sm text-accent">{error}</p>}
      </Card>
    </AppShell>
  );
}
