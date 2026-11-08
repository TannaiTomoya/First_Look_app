import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { assertYoutubeImport, getGrowthLimits } from "@/lib/growth/limits";

export const dynamic = "force-dynamic";

/** YouTube Data API で公開動画の統計を取り込み → growth_metrics */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });

  const admin = await createServiceClient();
  const limits = await getGrowthLimits(admin, user.id);
  const annualOnly = assertYoutubeImport(limits);
  if (annualOnly) {
    return NextResponse.json({ error: annualOnly, upgrade: "premium_annual" }, { status: 403 });
  }

  const body = (await request.json()) as { videoId?: string; url?: string };
  let videoId = (body.videoId ?? "").trim();
  if (!videoId && body.url) {
    const m =
      body.url.match(/[?&]v=([\w-]{6,})/) ||
      body.url.match(/youtu\.be\/([\w-]{6,})/) ||
      body.url.match(/shorts\/([\w-]{6,})/);
    videoId = m?.[1] ?? "";
  }
  if (!videoId) {
    return NextResponse.json({ error: "YouTubeの動画IDまたはURLを入力してください" }, { status: 400 });
  }

  const key = process.env.YOUTUBE_API_KEY;
  let title = `YouTube ${videoId}`;
  let views = 0;
  let likes = 0;
  let comments = 0;
  let source = "manual_fallback";

  if (key) {
    const api = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${encodeURIComponent(videoId)}&key=${key}`;
    const res = await fetch(api);
    if (!res.ok) {
      const t = await res.text();
      return NextResponse.json({ error: `YouTube APIエラー: ${t.slice(0, 200)}` }, { status: 400 });
    }
    const data = (await res.json()) as {
      items?: Array<{
        snippet?: { title?: string };
        statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
      }>;
    };
    const item = data.items?.[0];
    if (!item) return NextResponse.json({ error: "動画が見つかりません（非公開の可能性）" }, { status: 404 });
    title = item.snippet?.title ?? title;
    views = Number(item.statistics?.viewCount ?? 0);
    likes = Number(item.statistics?.likeCount ?? 0);
    comments = Number(item.statistics?.commentCount ?? 0);
    source = "youtube_api";
  } else {
    // APIキー無し: プレースホルダ行を作り、ユーザーが後から数値編集できるようタイトルだけ入れる
    title = `YouTube取込（要APIキー）: ${videoId}`;
  }

  const { data: profile } = await admin.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (!profile) {
    const base = (user.email ?? "user").split("@")[0].replace(/[^a-zA-Z0-9._-]/g, "") || "user";
    await admin.from("profiles").upsert(
      { id: user.id, display_name: base, username: `${base}-${user.id.slice(0, 8)}` },
      { onConflict: "id", ignoreDuplicates: true },
    );
  }

  const { data, error } = await admin
    .from("growth_metrics")
    .insert({
      user_id: user.id,
      platform: "youtube",
      title,
      views,
      likes,
      comments,
      saves: 0,
      follows_delta: 0,
      youtube_video_id: videoId,
      external_url: `https://www.youtube.com/watch?v=${videoId}`,
      note: source === "youtube_api" ? "YouTube Data API から自動取込" : "YOUTUBE_API_KEY 未設定のため0で作成。数値を手入力で更新してください",
      posted_at: new Date().toISOString().slice(0, 10),
    })
    .select("id, title, views, likes, comments")
    .single();

  if (error) {
    // youtube_video_id 列が無い場合は note に退避
    if (/youtube_video_id|external_url/i.test(error.message)) {
      const retry = await admin
        .from("growth_metrics")
        .insert({
          user_id: user.id,
          platform: "youtube",
          title,
          views,
          likes,
          comments,
          note: `yt:${videoId}`,
          posted_at: new Date().toISOString().slice(0, 10),
        })
        .select("id, title, views, likes, comments")
        .single();
      if (retry.error) return NextResponse.json({ error: retry.error.message }, { status: 400 });
      return NextResponse.json({ ok: true, metric: retry.data, source, needsMigration: true });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    metric: data,
    source,
    hint:
      source === "manual_fallback"
        ? "web/.env.local に YOUTUBE_API_KEY を入れると再生数などを自動取得できます"
        : null,
  });
}
