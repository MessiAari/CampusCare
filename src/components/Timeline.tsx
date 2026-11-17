import { EVENT_LABEL, LEVEL_NAMES } from "@/lib/constants";
import { cn, fmtDate } from "@/lib/utils";

type Row = { id: number; event_type: string; payload: any; actor: string; created_at: string; hash?: string };

function describe(r: Row): string {
  const base = EVENT_LABEL[r.event_type] ?? r.event_type;
  if (r.event_type === "escalated") {
    const why: Record<string, string> = {
      deadline_missed: "deadline missed",
      closure_rejected: "reporter rejected the closure",
      followup_not_stopped: "reporter said it has not stopped",
    };
    return `Escalated to ${LEVEL_NAMES[r.payload?.to] ?? "next level"} (${why[r.payload?.reason] ?? "review"})`;
  }
  if (r.event_type === "proof_added" && r.payload?.ai_flagged) return base + " (flagged as vague by AI check)";
  if (r.event_type === "followup_answered")
    return r.payload?.answer === "stopped" ? "Follow-up: reporter says it has stopped" : "Follow-up: reporter says it has not stopped";
  return base;
}

const dot: Record<string, string> = {
  escalated: "bg-amber",
  closure_rejected: "bg-danger",
  counselor_alerted: "bg-danger",
  closure_accepted: "bg-teal",
  original_viewed: "bg-navy",
};

export function Timeline({ rows, showHash }: { rows: Row[]; showHash?: boolean }) {
  if (!rows.length) return <p className="text-sm text-navy/50">No activity yet.</p>;
  return (
    <ol className="relative space-y-4 border-l border-navy/10 pl-5">
      {rows.map((r) => (
        <li key={r.id} className="relative">
          <span className={cn("absolute -left-[26px] top-1.5 h-3 w-3 rounded-full ring-4 ring-white", dot[r.event_type] ?? "bg-teal/60")} />
          <p className="text-sm font-medium leading-snug">{describe(r)}</p>
          <p className="text-xs text-navy/50">
            {fmtDate(r.created_at)} · by {r.actor === "reporter" ? "reporter" : r.actor === "system" ? "system" : r.actor}
            {showHash && r.hash ? <span className="ml-2 font-mono text-[10px] text-navy/35">#{r.hash.slice(0, 10)}</span> : null}
          </p>
        </li>
      ))}
    </ol>
  );
}
