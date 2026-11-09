"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button, Card } from "@/components/ui";
import { CheckoutButton } from "@/components/checkout-button";

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

  useEffect(() => {
    return () => stopCamera();
  }, []);

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
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        if (res.status === 401) {
          location.href = "/login?next=/capture";
          return;
        }
        throw new Error(data.error ?? "保存に失敗しました");
      }
      setStatus("保存しました。記録タブで確認できます。");
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
