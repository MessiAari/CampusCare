import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { QuickExit } from "@/components/QuickExit";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-aurora min-h-screen">
      <header className="sticky top-0 z-30 px-3 pt-3">
        <div className="glass mx-auto flex h-14 max-w-5xl items-center justify-between rounded-2xl px-4 shadow-soft">
          <Link href="/" className="flex items-center gap-2 font-heading text-lg font-extrabold text-navy">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#2FA896] to-teal text-white shadow-[0_6px_14px_-6px_rgba(22,124,112,0.8)]">
              <ShieldCheck className="h-[18px] w-[18px]" />
            </span>
            Campus<span className="-ml-2 text-teal">Care</span>
          </Link>
          <QuickExit />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-8">{children}</main>
      <footer className="mx-auto max-w-5xl px-4 pb-8 text-center text-xs text-navy/50">
        In immediate danger? Call campus security or 112. Feeling overwhelmed? Tele-MANAS 14416 is free, 24×7.
      </footer>
    </div>
  );
}
