"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { fileToCanvas } from "@/lib/face-tools";
import { qualityIssues, register } from "@/lib/face-mesh/canonical";
import { detectFace } from "@/lib/face-mesh/landmarker";

/** 指標の算出方法を変えたら上げる（時系列の比較可能性を判定するため） */
export const SNAPSHOT_MODEL_VERSION = "mp-face-landmarker-f16-1/canonical-v1";

export type SnapshotRow = {
  jaw_width: number;
  cheek_width: number;
  jaw_ratio: number;
  face_aspect: number;
  yaw: number;
  pitch: number;
  roll: number;
  registration: "matrix" | "landmarks";
  quality_ok: boolean;
  model_version: string;
};

/** 端末内で顔を検出し、構造指標だけを返す（座標・画像は外に出さない） */
export async function measureFile(file: File): Promise<{ row: SnapshotRow; issues: string[] } | null> {
  const canvas = await fileToCanvas(file, 900);
  const det = await detectFace(canvas);
  if (!det) return null;
  const reg = register(det.face, det.matrix);
  const jawOpen = det.blendshapes.find((b) => b.name === "jawOpen")?.score ?? 0;
  const issues = qualityIssues(reg.pose, jawOpen);
  return {
    issues,
    row: {
      jaw_width: reg.metrics.jawWidth,
      cheek_width: reg.metrics.cheekWidth,
      jaw_ratio: reg.metrics.jawRatio,
      face_aspect: reg.metrics.faceAspect,
      yaw: reg.pose.yaw,
      pitch: reg.pose.pitch,
      roll: reg.pose.roll,
      registration: reg.source,
      quality_ok: issues.length === 0,
      model_version: SNAPSHOT_MODEL_VERSION,
    },
  };
}

/** user_id は送らない（DB 側で auth.uid() が入り、RLS が本人・同意・記録の所有を確認する） */
export async function saveSnapshot(supabase: SupabaseClient, row: SnapshotRow, lookRecordId: string | null) {
  const { error } = await supabase
    .from("face_landmark_snapshots")
    .insert({ ...row, look_record_id: lookRecordId });
  if (error) throw new Error(error.message);
}

/** RLS で本人の同意行だけが見える。行がある = 同意済み */
export async function getConsent(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.from("face_landmark_consents").select("user_id").maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

/** false で取り消すと、DB 側で本人の snapshot が全削除される */
export async function setConsent(supabase: SupabaseClient, enabled: boolean) {
  const { error } = await supabase.rpc("set_landmark_consent", { enabled });
  if (error) throw new Error(error.message);
}

export async function countSnapshots(supabase: SupabaseClient): Promise<number> {
  const { count } = await supabase.from("face_landmark_snapshots").select("id", { count: "exact", head: true });
  return count ?? 0;
}

/** RLS で本人の行だけが対象になる */
export async function deleteAllSnapshots(supabase: SupabaseClient) {
  const { error } = await supabase
    .from("face_landmark_snapshots")
    .delete()
    .not("id", "is", null);
  if (error) throw new Error(error.message);
}
