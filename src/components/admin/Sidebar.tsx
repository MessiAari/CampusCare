"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Flame, Inbox, LogOut, ShieldCheck } from "lucide-react";
import { browserDb } from "@/lib/supabase/browser";
import { cn, titleCase } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Inbox", icon: Inbox },
  { href: "/admin/hotspots", label: "Hotspots", icon: Flame },
  { href: "/admin/accountability", label: "Accountability", icon: BarChart3 },
];

export function Sidebar({ name, role }: { name: string; role: string }) {
  const path = usePathname();
  return (
    <aside className="panel-dark sticky top-0 flex h-screen w-60 shrink-0 flex-col overflow-hidden p-4 text-white">
      <div className="dots-light pointer-events-none absolute inset-0 opacity-60" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-[#2FA896]/30 blur-3xl" />
      <div className="relative flex items-center gap-2 px-2 py-2 font-heading text-lg font-extrabold">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#2FA896] to-teal shadow-lg">
          <ShieldCheck className="h-5 w-5" />
        </span>
        CampusCare
      </div>
      <nav className="relative mt-6 space-y-1">
        {NAV.map((n) => {
          const active = n.href === "/admin" ? path === "/admin" || path.startsWith("/admin/case") : path.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                active ? "bg-white/15 text-white shadow-[inset_3px_0_0_#5FD3C2]" : "text-white/60 hover:bg-white/5 hover:text-white"
              )}
            >
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="relative mt-auto rounded-2xl bg-white/10 p-3 ring-1 ring-white/10 backdrop-blur">
        <p className="truncate text-sm font-semibold">{name}</p>
        <p className="text-xs text-white/50">{titleCase(role)}</p>
        <button
          type="button"
          onClick={async () => {
            await browserDb().auth.signOut();
            window.location.assign("/admin/login");
          }}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-white/70 hover:text-white"
        >
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      </div>
    </aside>
  );
}
