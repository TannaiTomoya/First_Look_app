import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Button({
  href,
  variant = "primary",
  className,
  children,
  ...props
}: {
  href?: string;
  variant?: "primary" | "ghost" | "outline" | "accent";
  className?: string;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles = {
    primary:
      "bg-brand text-white shadow-lg shadow-indigo-500/20 hover:brightness-110",
    accent: "bg-accent text-white shadow-lg shadow-rose-400/20 hover:brightness-110",
    outline: "border border-line bg-card text-foreground hover:bg-white",
    ghost: "text-foreground hover:bg-white/60",
  }[variant];

  const cls = cn(
    "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition",
    styles,
    className,
  );

  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }

  return (
    <button className={cls} {...props}>
      {children}
    </button>
  );
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-line bg-card p-6 shadow-[0_12px_40px_rgba(23,20,31,0.06)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
