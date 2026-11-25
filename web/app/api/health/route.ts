import { NextResponse } from "next/server";
import { pingAi } from "@/lib/ai";
import { isSupabaseConfigured } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * 死活監視用。
 * - 既定: Worker と Supabase（Auth）の疎通を確認。どちらかが落ちていれば 503
 * - `?deep=1`: AI モデルの疎通も確認（トークンを消費するため監視では使わない。結果は10分キャッシュ）
 *
 * 外部の監視サービスから 5 分おきに叩くと、Supabase 無料プランの自動一時停止も防げる。
 */
export async function GET(request: Request) {
  const deep = new URL(request.url).searchParams.get("deep") === "1";
  const supabase = await checkSupabase();
  const ai = deep ? await pingAi() : undefined;

  const ok = supabase.ok && (ai ? ai.ok : true);
  return NextResponse.json(
    { status: ok ? "ok" : "degraded", service: "firstlook", supabase, ...(ai ? { ai } : {}) },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}

async function checkSupabase(): Promise<{ ok: boolean; ms?: number; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase 未設定" };
  const started = Date.now();
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    const ms = Date.now() - started;
    return res.ok ? { ok: true, ms } : { ok: false, ms, error: `auth health ${res.status}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message.slice(0, 200) : "unknown" };
  }
}
