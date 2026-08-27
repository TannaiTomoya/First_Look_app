"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Camera,
  Home,
  Images,
  Settings,
  Sparkles,
} from "lucide-react";
import { Logo } from "@/components/site-header";
import { cn } from "@/components/ui";

const items = [
  { href: "/dashboard", label: "ホーム", icon: Home },
  { href: "/capture", label: "撮影", icon: Camera },
  { href: "/records", label: "記録", icon: Images },
  { href: "/progress", label: "変化", icon: Sparkles },
  { href: "/consult", label: "相談", icon: CalendarDays },
];

export function AppShell({
  children,
  isAdmin,
}: {
  children: React.ReactNode;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      <header className="sticky top-0 z-20 border-b border-line bg-card/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Logo />
          <div className="flex items-center gap-3 text-sm">
            {isAdmin && (
              <Link href="/admin" className="text-brand font-medium">
                管理
              </Link>
            )}
            <Link href="/pricing" className="hidden text-muted sm:inline">
              料金
            </Link>
            <Link href="/settings" aria-label="設定">
              <Settings className="h-5 w-5 text-muted" />
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card/95 backdrop-blur md:hidden">
        <ul className="grid grid-cols-5">
          {items.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2 text-[11px]",
                    active ? "text-brand" : "text-muted",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
