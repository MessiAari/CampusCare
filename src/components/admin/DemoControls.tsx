"use client";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, FastForward, FlaskConical, Loader2 } from "lucide-react";
import {
  demoFastForward,
  demoResetClock,
  demoResetRateLimits,
  demoTamper,
  demoTriggerFollowup,
} from "@/app/admin/actions";
import { cn } from "@/lib/utils";

/** Floating panel for judges. Rendered only when DEMO_MODE=true. */
export function DemoControls({ offsetDays }: { offsetDays: number }) {
  const router = useRouter();
  const path = usePathname();
  const caseId = path.match(/\/admin\/case\/([0-9a-f-]{36})/)?.[1] ?? null;
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");

  async function run(key: string, fn: () => Promise<any>, done: (r: any) => string) {
    setBusy(key);
    setNote("");
    try {
      const r = await fn();
      setNote(r?.ok === false ? r.error : done(r));
    } catch (e: any) {
      setNote(e?.message ?? "Failed");
    }
    setBusy("");
    router.refresh();
  }

  const Btn = ({ k, label, onClick, disabled }: { k: string; label: string; onClick: () => void; disabled?: boolean }) => (
    <button
      type="button"
      disabled={!!busy || disabled}
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-lg bg-white/10 px-3 py-2 text-left text-xs font-semibold hover:bg-white/20 disabled:opacity-40"
    >
      {label}
      {busy === k && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
    </button>
  );

  return (
    <div className="fixed bottom-4 right-4 z-50 w-64 rounded-2xl bg-navy text-white shadow-2xl ring-1 ring-white/10">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-bold">
          <FlaskConical className="h-4 w-4 text-amber" /> Demo controls
        </span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open ? "" : "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-3 px-4 pb-4">
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/50">
              <FastForward className="h-3 w-3" /> Time{" "}
              <span className="normal-case text-amber">{offsetDays ? `+${Math.round(offsetDays * 10) / 10} days` : "real time"}</span>
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              <Btn k="d1" label="+1 day" onClick={() => run("d1", () => demoFastForward(1), (r) => `Moved 1 day ahead. ${r.escalated} case(s) escalated.`)} />
              <Btn k="d7" label="+7 days" onClick={() => run("d7", () => demoFastForward(7), (r) => `Moved 7 days ahead. ${r.escalated} case(s) escalated.`)} />
            </div>
            <div className="mt-1.5">
              <Btn k="rc" label="Back to real time" disabled={!offsetDays} onClick={() => run("rc", demoResetClock, () => "Clock reset.")} />
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/50">
              This case {caseId ? "" : <span className="normal-case text-white/40">(open a case first)</span>}
            </p>
            <div className="space-y-1.5">
              <Btn k="fu" label="Trigger day-7 follow-up" disabled={!caseId} onClick={() => run("fu", () => demoTriggerFollowup(caseId!), () => "Follow-up is now due on the student's case page (shown once the case is closed).")} />
              <Btn k="tp" label="Tamper with a log row" disabled={!caseId} onClick={() => run("tp", () => demoTamper(caseId!), () => "One audit row was edited directly in the database.")} />
              <Btn k="ut" label="Undo tampering" disabled={!caseId} onClick={() => run("ut", () => demoTamper(caseId!, true), () => "Audit row restored.")} />
            </div>
          </div>
          <Btn k="rl" label="Reset report rate limits" onClick={() => run("rl", demoResetRateLimits, () => "Rate limits cleared.")} />
          {note && <p className="rounded-lg bg-white/10 p-2 text-[11px] leading-snug text-white/80">{note}</p>}
        </div>
      )}
    </div>
  );
}
