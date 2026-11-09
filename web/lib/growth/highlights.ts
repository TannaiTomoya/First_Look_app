/**
 * ハイライト検出（ブラウザ）と区間切り抜き編集。
 * Workers に FFmpeg が無いため、解析・書き出しはクライアント側で行う。
 */

import { autoEditShortVideo, isVideoFile } from "@/lib/short-editor";

export type HighlightCandidate = {
  start_sec: number;
  end_sec: number;
  score: number;
  reason: string;
};

/** 音声エネルギーからハイライト候補を抽出。失敗時は均等分割にフォールバック */
export async function detectHighlights(
  file: File,
  opts?: { clipLen?: number; maxCandidates?: number },
): Promise<{ highlights: HighlightCandidate[]; duration: number }> {
  const clipLen = opts?.clipLen ?? 15;
  const maxCandidates = opts?.maxCandidates ?? 5;

  const duration = await probeDuration(file);
  if (!Number.isFinite(duration) || duration < 3) {
    throw new Error("動画が短すぎるか、長さを取得できません");
  }

  try {
    const peaks = await analyzeAudioPeaks(file, duration, clipLen);
    if (peaks.length > 0) {
      return { highlights: peaks.slice(0, maxCandidates), duration };
    }
  } catch {
    // フォールバックへ
  }

  return { highlights: evenHighlights(duration, clipLen, maxCandidates), duration };
}

function evenHighlights(duration: number, clipLen: number, n: number): HighlightCandidate[] {
  const usable = Math.max(0, duration - clipLen);
  const out: HighlightCandidate[] = [];
  const count = Math.min(n, Math.max(1, Math.floor(duration / Math.max(clipLen * 0.6, 1))));
  for (let i = 0; i < count; i += 1) {
    const start = count === 1 ? 0 : (usable * i) / (count - 1 || 1);
    const end = Math.min(duration, start + clipLen);
    out.push({
      start_sec: round1(start),
      end_sec: round1(end),
      score: round2(0.55 - i * 0.05),
      reason: "均等分割候補（音声解析フォールバック）",
    });
  }
  return out;
}

async function probeDuration(file: File): Promise<number> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("metadata"));
    });
    return video.duration;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function analyzeAudioPeaks(
  file: File,
  duration: number,
  clipLen: number,
): Promise<HighlightCandidate[]> {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    const buf = await file.arrayBuffer();
    const audio = await ctx.decodeAudioData(buf.slice(0));
    const ch = audio.getChannelData(0);
    const sr = audio.sampleRate;
    const winSec = 1.0;
    const win = Math.floor(sr * winSec);
    const energies: { t: number; e: number }[] = [];
    for (let i = 0; i + win < ch.length; i += win) {
      let sum = 0;
      for (let j = 0; j < win; j += 32) {
        const v = ch[i + j];
        sum += v * v;
      }
      energies.push({ t: i / sr, e: sum / (win / 32) });
    }
    if (energies.length === 0) return [];

    // 移動平均で平滑化
    const smooth = energies.map((_, idx) => {
      const a = energies.slice(Math.max(0, idx - 1), idx + 2);
      return { t: energies[idx].t, e: a.reduce((s, x) => s + x.e, 0) / a.length };
    });
    const sorted = [...smooth].sort((a, b) => b.e - a.e);
    const picked: HighlightCandidate[] = [];
    const minGap = clipLen * 0.7;

    for (const p of sorted) {
      if (picked.length >= 5) break;
      const start = Math.max(0, Math.min(duration - clipLen, p.t - clipLen * 0.35));
      const end = Math.min(duration, start + clipLen);
      if (picked.some((h) => Math.abs(h.start_sec - start) < minGap)) continue;
      const maxE = sorted[0].e || 1;
      picked.push({
        start_sec: round1(start),
        end_sec: round1(end),
        score: round2(Math.min(0.99, 0.4 + (p.e / maxE) * 0.55)),
        reason: "声量ピーク区間",
      });
    }
    return picked.sort((a, b) => a.start_sec - b.start_sec);
  } finally {
    await ctx.close().catch(() => undefined);
  }
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** 指定区間を 9:16 クリップ化 */
export async function exportHighlightClip(
  file: File,
  startSec: number,
  endSec: number,
  title: string,
  template?: { clipLen?: number; typoScale?: number; overlay?: "heavy" | "light" },
): Promise<{ blob: Blob; mime: string; duration: number }> {
  if (!isVideoFile(file)) throw new Error("動画ファイルを指定してください");
  const rawLen = Math.max(1, endSec - startSec);
  const len = template?.clipLen ? Math.min(rawLen, template.clipLen) : rawLen;
  return autoEditShortVideo(file, {
    title,
    maxSeconds: len,
    startSec,
    typoScale: template?.typoScale,
    overlay: template?.overlay,
  });
}
