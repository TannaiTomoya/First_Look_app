import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  if (!isSupabaseConfigured()) {
    return (
      <AppShell>
        <Card>Supabase未設定</Card>
      </AppShell>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: records } = await supabase
    .from("look_records")
    .select("photo_path, created_at, is_day0")
    .eq("user_id", user?.id ?? "")
    .order("created_at", { ascending: true });

  const day0 = records?.find((r) => r.is_day0) ?? records?.[0];
  const today = records?.[records.length - 1];

  async function url(path?: string) {
    if (!path) return null;
    const { data } = await supabase.storage.from("looks").createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  }

  const [before, after] = await Promise.all([url(day0?.photo_path), url(today?.photo_path)]);

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-semibold">変化</h1>
      <p className="mt-1 text-sm text-muted">Day0 と Today を並べて確認する。</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <p className="text-sm font-medium text-brand">BEFORE</p>
          <div className="mt-3 aspect-[3/4] overflow-hidden rounded-2xl bg-zinc-200">
            {before ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={before} alt="day0" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center text-sm text-muted">未記録</div>
            )}
          </div>
        </Card>
        <Card>
          <p className="text-sm font-medium text-brand">AFTER</p>
          <div className="mt-3 aspect-[3/4] overflow-hidden rounded-2xl bg-zinc-200">
            {after ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={after} alt="today" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center text-sm text-muted">未記録</div>
            )}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
