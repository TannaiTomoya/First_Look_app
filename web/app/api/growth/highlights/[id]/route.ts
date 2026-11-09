import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** ハイライトの採用トグル / 一括更新 */
export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });

  const body = (await request.json()) as { selected?: boolean };
  if (typeof body.selected !== "boolean") {
    return NextResponse.json({ error: "selected が必要です" }, { status: 400 });
  }

  const admin = await createServiceClient();
  const { data: row } = await admin
    .from("growth_highlights")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();
  if (!row || row.user_id !== user.id) {
    return NextResponse.json({ error: "編集できません" }, { status: 403 });
  }

  const { error } = await admin.from("growth_highlights").update({ selected: body.selected }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
