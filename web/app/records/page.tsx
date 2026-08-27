import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function RecordsPage() {
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
    .select("id, created_at, note, photo_path, is_day0")
    .eq("user_id", user?.id ?? "")
    .order("created_at", { ascending: false });

  const withUrls = await Promise.all(
    (records ?? []).map(async (r) => {
      const { data } = await supabase.storage.from("looks").createSignedUrl(r.photo_path, 3600);
      return { ...r, url: data?.signedUrl ?? null };
    }),
  );

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-semibold">記録</h1>
      <p className="mt-1 text-sm text-muted">積み上がるほど、変化が見える。</p>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        {withUrls.length === 0 && (
          <Card className="col-span-full">まだ記録がありません。撮影から始めましょう。</Card>
        )}
        {withUrls.map((r) => (
          <Card key={r.id} className="p-3">
            <div className="aspect-[3/4] overflow-hidden rounded-2xl bg-zinc-200">
              {r.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.url} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <p className="mt-2 text-xs text-muted">
              {r.is_day0 ? "Day 0 · " : ""}
              {new Date(r.created_at).toLocaleDateString("ja-JP")}
            </p>
            {r.note && <p className="mt-1 text-sm">{r.note}</p>}
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
