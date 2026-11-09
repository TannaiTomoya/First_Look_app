import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
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
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect("/dashboard");
  }

  const [{ data: users }, { data: payments }, { data: subs }] = await Promise.all([
    supabase.from("profiles").select("id, display_name, role, created_at").order("created_at", { ascending: false }).limit(50),
    supabase.from("payments").select("id, amount, kind, status, created_at").order("created_at", { ascending: false }).limit(50),
    supabase.from("subscriptions").select("status, user_id, current_period_end").limit(50),
  ]);

  const revenue = (payments ?? [])
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <AppShell isAdmin>
      <h1 className="font-display text-3xl font-semibold">管理者</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm text-muted">ユーザー</p>
          <p className="stat-num text-3xl">{users?.length ?? 0}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">売上（表示件）</p>
          <p className="stat-num text-3xl">¥{revenue.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">サブスク</p>
          <p className="stat-num text-3xl">{subs?.filter((s) => s.status === "active").length ?? 0}</p>
        </Card>
      </div>
      <Card className="mt-4 overflow-x-auto">
        <h2 className="font-semibold">決済</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="py-2">日時</th>
              <th>種別</th>
              <th>金額</th>
              <th>状態</th>
            </tr>
          </thead>
          <tbody>
            {(payments ?? []).map((p) => (
              <tr key={p.id} className="border-t border-line">
                <td className="py-2">{new Date(p.created_at).toLocaleString("ja-JP")}</td>
                <td>{p.kind}</td>
                <td>¥{p.amount.toLocaleString()}</td>
                <td>{p.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </AppShell>
  );
}
