import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { Chat } from "@/components/Chat";
import { Countdown } from "@/components/Countdown";
import { IntegrityBadge } from "@/components/IntegrityBadge";
import { CaseActions } from "@/components/student/CaseActions";
import { Timeline } from "@/components/Timeline";
import { StatusBadge, UrgencyBadge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { verifyChain, type AuditRow } from "@/lib/audit";
import { getAccessibleReport } from "@/lib/cases";
import { now } from "@/lib/clock";
import { ACTIVE_STATUSES, LEVEL_NAMES, STATUS_LABEL } from "@/lib/constants";
import { serviceDb } from "@/lib/supabase/service";
import { cn, titleCase } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CasePage({ params }: { params: { code: string } }) {
  const r = await getAccessibleReport(params.code);
  if (!r) {
    return (
      <Card className="rise mx-auto mt-10 max-w-md text-center">
        <Lock className="mx-auto h-8 w-8 text-navy/30" />
        <h1 className="mt-3 text-lg font-bold">This case is locked</h1>
        <p className="mt-1 text-sm text-navy/60">
          Enter your case code and passphrase on the home page to open it.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm font-semibold text-teal underline">
          Go to home
        </Link>
      </Card>
    );
  }

  const db = serviceDb();
  const at = await now();
  const [{ data: audit }, { data: proofs }, { data: followups }] = await Promise.all([
    db.from("audit_log").select("*").eq("report_id", r.id).order("id"),
    db.from("proof_of_action").select("description, created_at").eq("report_id", r.id).order("created_at", { ascending: false }).limit(1),
    db.from("followups").select("id, due_at").eq("report_id", r.id).eq("answered", false).lte("due_at", at.toISOString()).order("due_at").limit(1),
  ]);
  const rows = (audit ?? []) as AuditRow[];
  const integrity = verifyChain(rows);
  const active = ACTIVE_STATUSES.includes(r.status);
  const followup = r.status === "closed" ? followups?.[0] ?? null : null;

  return (
    <div className="rise mx-auto max-w-2xl space-y-4">
      <Link href="/" className="inline-flex items-center gap-1 text-sm font-medium text-navy/60 hover:text-navy">
        <ArrowLeft className="h-4 w-4" /> Home
      </Link>

      <Card className="overflow-hidden p-0">
        <div className="panel-dark relative px-5 pb-9 pt-5 text-white">
          <div className="dots-light absolute inset-0" />
          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-white/60">Your case</p>
              <h1 className="text-3xl font-extrabold tabular-nums">{r.case_code}</h1>
            </div>
            <IntegrityBadge ok={integrity.ok} events={rows.length} className={integrity.ok ? "bg-white/15 text-white" : ""} />
          </div>
          <div className="relative mt-3 flex flex-wrap gap-2">
            <StatusBadge status={r.status} />
            <UrgencyBadge urgency={r.urgency} />
            <span className="inline-flex items-center rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold">{titleCase(r.category)}</span>
          </div>
        </div>
        <div className="px-5 pb-5">

        <div className="-mt-5 grid gap-3 sm:grid-cols-2">
          <div className="relative rounded-2xl bg-white p-4 shadow-soft ring-1 ring-navy/5">
            <p className="text-xs font-semibold text-navy/50">Currently with</p>
            <div className="mt-2 flex items-center gap-1.5">
              {LEVEL_NAMES.map((n, i) => (
                <div key={n} className="flex-1">
                  <div className={cn("h-1.5 rounded-full", i <= r.escalation_level ? (i === 0 ? "bg-teal" : i === 1 ? "bg-amber" : "bg-danger") : "bg-navy/10")} />
                  <p className={cn("mt-1.5 text-[11px] font-semibold", i === r.escalation_level ? "text-navy" : "text-navy/40")}>{n}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative rounded-2xl bg-white p-4 shadow-soft ring-1 ring-navy/5">
            <p className="text-xs font-semibold text-navy/50">
              {active ? `${LEVEL_NAMES[r.escalation_level]} must respond within` : "Status"}
            </p>
            {active ? (
              <>
                <Countdown deadline={r.deadline_at} serverNow={at.toISOString()} className="mt-1 text-2xl" />
                <p className="mt-0.5 text-[11px] text-navy/50">
                  {r.escalation_level < 2 ? "If this runs out, the case moves up automatically." : "This is the highest level."}
                </p>
              </>
            ) : (
              <p className="mt-1 text-lg font-bold">{STATUS_LABEL[r.status]}</p>
            )}
          </div>
        </div>
        </div>
      </Card>

      <CaseActions
        code={r.case_code}
        status={r.status}
        proof={r.status === "pending_confirmation" ? proofs?.[0] ?? null : null}
        followupId={followup?.id ?? null}
      />

      <Card>
        <CardTitle>What the committee sees</CardTitle>
        <p className="mt-2 whitespace-pre-wrap rounded-xl bg-mint/60 p-3.5 text-sm leading-relaxed">{r.scrubbed_summary}</p>
        <p className="mt-2 text-xs text-navy/50">
          Your original words are encrypted. If anyone opens them, it appears in the timeline below.
          {r.plus_one_count > 0 && ` ${r.plus_one_count} other student(s) reported the same incident.`}
        </p>
      </Card>

      <Card>
        <CardTitle>Messages</CardTitle>
        <p className="mb-3 text-sm text-navy/60">Chat with the committee without revealing who you are.</p>
        <Chat mode="reporter" reportId={r.id} caseCode={r.case_code} />
      </Card>

      <Card>
        <CardTitle className="mb-4">Timeline</CardTitle>
        <Timeline rows={[...rows].reverse()} />
      </Card>
    </div>
  );
}
