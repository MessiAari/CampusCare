import { ShieldAlert, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function IntegrityBadge({ ok, events, className }: { ok: boolean; events: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold",
        ok ? "bg-teal-100 text-teal-600" : "bg-danger text-white",
        className
      )}
      title={
        ok
          ? `All ${events} log entries match their hash chain.`
          : "A log entry no longer matches its hash. The record was changed after it was written."
      }
    >
      {ok ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
      {ok ? "Integrity verified ✓" : "Tampered ✗"}
    </span>
  );
}
