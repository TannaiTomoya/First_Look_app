import Link from "next/link";
import { Button } from "@/components/ui";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand text-sm text-white">F</span>
      FirstLook
    </Link>
  );
}

export function SiteHeader({ loggedIn }: { loggedIn?: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#120d1c]/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 text-white">
        <Logo />
        <nav className="hidden items-center gap-6 text-sm text-white/75 md:flex">
          <Link href="/#evidence" className="hover:text-white">根拠</Link>
          <Link href="/#features" className="hover:text-white">機能</Link>
          <Link href="/pricing" className="hover:text-white">料金</Link>
          <Link href="/coaches" className="hover:text-white">相談</Link>
        </nav>
        <div className="flex items-center gap-2">
          {loggedIn ? (
            <Button href="/dashboard" className="bg-white text-brand hover:bg-zinc-100">
              アプリを開く
            </Button>
          ) : (
            <>
              <Button href="/login" variant="ghost" className="text-white hover:bg-white/10">
                ログイン
              </Button>
              <Button href="/register" className="bg-white text-brand hover:bg-zinc-100">
                無料ではじめる
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-card">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-10 text-sm text-muted md:flex-row md:items-center md:justify-between">
        <p>© {new Date().getFullYear()} FirstLook</p>
        <div className="flex gap-4">
          <Link href="/pricing">料金</Link>
          <Link href="/login">ログイン</Link>
          <Link href="/privacy">プライバシー</Link>
        </div>
      </div>
    </footer>
  );
}
