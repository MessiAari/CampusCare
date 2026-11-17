import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ACTIVE_STATUSES, DEADLINE_HOURS, type Urgency } from "./constants";
import { appendAudit } from "./audit";
import { now } from "./clock";
import { serviceDb } from "./supabase/service";

export function deadlineFor(urgency: string, from: Date): Date {
  const hours = DEADLINE_HOURS[urgency as Urgency] ?? DEADLINE_HOURS.normal;
  return new Date(from.getTime() + hours * 3600_000);
}

/** Move a case one level up (committee -> dean -> external), reset its timer and log it. */
export async function escalate(
  db: SupabaseClient,
  report: { id: string; escalation_level: number; urgency: string },
  reason: string,
  at: Date,
  extra: Record<string, unknown> = {}
) {
  const to = Math.min(2, report.escalation_level + 1);
  await db
    .from("reports")
    .update({ escalation_level: to, deadline_at: deadlineFor(report.urgency, at).toISOString(), ...extra })
    .eq("id", report.id);
  if (to !== report.escalation_level) {
    await appendAudit(db, {
      report_id: report.id,
      event_type: "escalated",
      payload: { from: report.escalation_level, to, reason },
      actor: "system",
      at,
    });
  }
  return to;
}

/** Escalates every active case whose deadline has passed. Runs on admin page load and from cron. */
export async function checkEscalations(): Promise<number> {
  const db = serviceDb();
  const at = await now();
  const { data: overdue } = await db
    .from("reports")
    .select("id, escalation_level, urgency")
    .in("status", ACTIVE_STATUSES)
    .lt("escalation_level", 2)
    .lt("deadline_at", at.toISOString());
  for (const r of overdue ?? []) await escalate(db, r, "deadline_missed", at);
  return overdue?.length ?? 0;
}
