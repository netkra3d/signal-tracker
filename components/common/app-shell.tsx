import Link from "next/link";
import { PropsWithChildren } from "react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/trades", label: "거래기록" },
  { href: "/analytics", label: "분석" },
  { href: "/settings", label: "설정" },
];

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#14304f,transparent_45%),linear-gradient(180deg,#0b1522,#081018)] text-slate-100">
      <header className="border-b border-white/10 bg-black/20 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="font-semibold tracking-[0.2em] text-cyan-300">
            SIGNAL TRACKER
          </Link>
          <nav className="flex flex-wrap gap-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn("rounded-full px-4 py-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white")}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6">{children}</main>
    </div>
  );
}
