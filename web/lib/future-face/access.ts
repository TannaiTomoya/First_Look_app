import type { Entitlements } from "@/lib/entitlements";
import type { FutureParams } from "@/lib/face-mesh/future-face";

/** 年額以外が見られる固定プリセット */
export const PREVIEW_PARAMS: FutureParams = { contourPct: -5, cheekPct: 0, clarity: 60, nasolabial: 0 };

export type FutureFaceAccess = {
  /** 全パラメータを操作できる（年額特典） */
  fullParams: boolean;
  preset: FutureParams;
};

export function getFutureFaceAccess(ent: Pick<Entitlements, "isAnnual">): FutureFaceAccess {
  return { fullParams: ent.isAnnual, preset: PREVIEW_PARAMS };
}

/** 処理はブラウザ内で完結するため、この制限は表示上のもの（サーバー資源は消費しない） */
export function clampParams(access: FutureFaceAccess, params: FutureParams): FutureParams {
  return access.fullParams ? params : access.preset;
}

export function futureFaceUpgradeMessage(ent: Pick<Entitlements, "isPremium" | "isAnnual">): string | null {
  if (ent.isAnnual) return null;
  return ent.isPremium
    ? "全パラメータの操作は年額Premiumの特典です。月額からの切り替えで開放されます。"
    : "全パラメータの操作は年額Premiumの特典です。今はプリセットのプレビューのみ表示しています。";
}
