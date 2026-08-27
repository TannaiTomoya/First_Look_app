import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui";
import { CheckoutButton } from "@/components/checkout-button";
import { isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CoachesPage() {
  let coaches: Array<{
    id: string;
    name: string;
    bio: string | null;
    specialty: string | null;
    price_jpy: number;
    verified: boolean;
  }> = [];

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("coaches")
      .select("id, name, bio, specialty, price_jpy, verified")
      .order("created_at", { ascending: true });
    coaches = data ?? [];
  }

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-semibold">コーチ相談</h1>
      <p className="mt-1 text-sm text-muted">補助機能。セッション成立時に手数料が発生します。</p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {coaches.length === 0 && (
          <Card>コーチデータはマイグレーション適用後に表示されます。</Card>
        )}
        {coaches.map((c) => (
          <Card key={c.id}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">{c.name}</h2>
                <p className="text-sm text-brand">{c.specialty}</p>
              </div>
              {c.verified && (
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-brand">
                  認証
                </span>
              )}
            </div>
            <p className="mt-3 text-sm text-muted">{c.bio}</p>
            <p className="mt-4 font-semibold">¥{c.price_jpy.toLocaleString()}</p>
            <div className="mt-4">
              <CheckoutButton
                kind="coach_session"
                coachId={c.id}
                label="セッションを予約"
              />
            </div>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
