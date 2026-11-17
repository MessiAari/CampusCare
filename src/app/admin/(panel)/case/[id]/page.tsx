import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, FileText, HeartPulse, Paperclip, Sparkles, Users } from "lucide-react";
import { CaseActionBar, ProofForm, ViewOriginal } from "@/components/admin/CasePanels";
import { Chat } from "@/components/Chat";
import { Countdown } from "@/components/Countdown";
import { IntegrityBadge } from "@/components/IntegrityBadge";
import { Timeline } from "@/components/Timeline";
import { Badge, StatusBadge, UrgencyBadge } from "@/components/ui/badge";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { ADMIN_REPORT_COLS, requireAdmin } from "@/lib/admin";
import { verifyChain, type AuditRow } from "@/lib/audit";
import { now } from "@/lib/clock";
import { ACTIVE_STATUSES, LEVEL_NAMES } from "@/lib/constants";
import { adminDb } from "@/lib/supabase/server";
import { serviceDb } from "@/lib/supabase/service";
import { fmtDate, titleCase } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminCase({ params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!/^[0-9a-f-]{36}$/.test(params.id)) notFound();
  const sb = adminDb();
  const { data } = await sb.from("reports").select(ADMIN_REPORT_COLS).eq("id", params.id).maybeSingle();
  if (!data) notFound();
  const r = data as any;

  const [{ data: evidence }, { data: proofs }, { data: audit }, { data: admins }] = await Promise.all([
    sb.from("evidence").select("*").eq("report_id", r.id).order("uploaded_at"),
    sb.from("proof_of_action").select("*").eq("report_id", r.id).order("created_at", { ascending: false }),
    sb.from("audit_log").select("*").eq("report_id", r.id).order("id"),
    sb.from("admins").select("id, name, role"),
  ]);
  const rows = (audit ?? []) as AuditRow[];
  const integrity = verifyChain(rows);
  const at = await now();
  const active = ACTIVE_STATUSES.includes(r.status);
  const canAct = admin.level >= r.escalation_level;
  const adminName = (id: string | null) => admins?.find((a) => a.id === id)?.name ?? "Unassigned";

  // Signed links are created server-side; the buckets are private.
  const storage = serviceDb().storage;
  const evLinks = await Promise.all(
    (evidence ?? []).map(async (e) => (await storage.from("evidence").createSignedUrl(e.storage_path, 3600)).data?.signedUrl ?? null)
  );
  const proofLinks = await Promise.all(
    (proofs ?? []).map(async (p) =>
      p.file_path ? (await storage.from("proof").createSignedUrl(p.file_path, 3600)).data?.signedUrl ?? null : null
    )
  );
  const latestFlagged = proofs?.[0]?.ai_boilerplate_flag === true;

  return (
    <div className="space-y-5">
      <Link href="/admin" className="inline-flex items-center gap-1 text-sm font-medium text-navy/60 hover:text-navy">
        <ArrowLeft className="h-4 w-4" /> Inbox
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tabular-nums">{r.case_code}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <UrgencyBadge urgency={r.urgency} />
            <StatusBadge status={r.status} />
            <Badge tone={r.escalation_level === 0 ? "teal" : r.escalation_level === 1 ? "amber" : "red"}>
              With: {LEVEL_NAMES[r.escalation_level]}
            </Badge>
            {r.plus_one_count > 0 && (
              <Badge tone="teal">
                <Users className="h-3 w-3" /> +{r.plus_one_count} same incident
              </Badge>
            )}
            {r.reopen_count > 0 && <Badge tone="red">Reopened ×{r.reopen_count}</Badge>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <IntegrityBadge ok={integrity.ok} events={rows.length} />
          {active && (
            <span className="text-sm text-navy/60">
              Deadline: <Countdown deadline={r.deadline_at} serverNow={at.toISOString()} />
            </span>
          )}
        </div>
      </div>

      {r.self_harm_flag && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger p-4 text-white">
          <HeartPulse className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-bold">Counselor alerted</p>
            <p className="text-sm text-white/85">
              This report mentions self-harm or a threat of serious violence. The campus counselor has been notified and
              the case is marked critical (24-hour deadline).
            </p>
          </div>
        </div>
      )}
      {!integrity.ok && (
        <div className="flex items-start gap-3 rounded-2xl border border-danger/40 bg-danger-100 p-4 text-danger">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-sm">
            <b>The audit log for this case has been altered.</b> Entry #{integrity.brokenAt} no longer matches its
            recorded hash, so the history below cannot be trusted.
          </p>
        </div>
      )}
      {!canAct && (
        <div className="rounded-2xl bg-amber-100 p-4 text-sm text-[#7A5311]">
          This case has been escalated to the <b>{LEVEL_NAMES[r.escalation_level]}</b>. Your role can view it but can no
          longer act on it.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-teal" />
              <CardTitle>AI brief</CardTitle>
            </div>
            <p className="mt-3 whitespace-pre-wrap rounded-xl bg-mint/60 p-4 text-sm leading-relaxed">{r.scrubbed_summary}</p>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              {[
                ["Category", titleCase(r.category)],
                ["Location", r.location ?? "Unknown"],
                ["Time of day", r.time_of_day ? titleCase(r.time_of_day) : "Unknown"],
                ["Spam score", Math.round(Number(r.spam_score) * 100) + "%"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-navy/50">{k}</dt>
                  <dd className="font-semibold">{v}</dd>
                </div>
              ))}
              <div className="col-span-2 sm:col-span-4">
                <dt className="text-xs text-navy/50">Accused (as described)</dt>
                <dd className="font-semibold">{r.accused_descriptor ?? "Not described"}</dd>
              </div>
            </dl>
            <ViewOriginal reportId={r.id} canAct={canAct} />
          </Card>

          <Card>
            <div className="flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-teal" />
              <CardTitle>Evidence</CardTitle>
            </div>
            {!evidence?.length ? (
              <p className="mt-3 text-sm text-navy/50">No files were attached to this report.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {evidence.map((e, i) => (
                  <li key={e.id} className="rounded-xl bg-cloud p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 truncate text-sm font-medium">
                        <FileText className="h-4 w-4 shrink-0 text-navy/40" /> {e.file_name ?? "file"}
                      </span>
                      {evLinks[i] && (
                        <a href={evLinks[i]!} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-semibold text-teal underline">
                          Open
                        </a>
                      )}
                    </div>
                    <p className="mt-1 break-all font-mono text-[11px] text-navy/50">SHA-256 {e.sha256}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardTitle>Proof of action</CardTitle>
            <CardHint>Required before closure can be requested. The reporter sees the latest entry.</CardHint>
            {proofs?.map((p, i) => (
              <div key={p.id} className="mt-3 rounded-xl bg-cloud p-3.5">
                <p className="whitespace-pre-wrap text-sm">{p.description}</p>
                <p className="mt-1 text-xs text-navy/50">
                  {adminName(p.admin_id)} · {fmtDate(p.created_at)}
                  {proofLinks[i] && (
                    <a href={proofLinks[i]!} target="_blank" rel="noreferrer" className="ml-2 font-semibold text-teal underline">
                      Attachment
                    </a>
                  )}
                </p>
                {p.ai_boilerplate_flag ? (
                  <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-100 p-2.5 text-xs font-medium text-[#7A5311]">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      <b>AI check: looks like boilerplate.</b> {p.ai_note}
                    </span>
                  </p>
                ) : (
                  p.ai_note && <p className="mt-2 text-xs text-teal-600">AI check: {p.ai_note}</p>
                )}
              </div>
            ))}
            {active && canAct && <ProofForm reportId={r.id} />}
            <CaseActionBar
              reportId={r.id}
              status={r.status}
              canAct={canAct}
              hasProof={(proofs?.length ?? 0) > 0}
              latestFlagged={latestFlagged}
            />
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardTitle>Chat with reporter</CardTitle>
            <CardHint className="mb-3">You appear only as &quot;Committee&quot;.</CardHint>
            <Chat
              mode="admin"
              reportId={r.id}
              caseCode={r.case_code}
              disabled={canAct ? undefined : "Read only: this case is with a higher authority."}
            />
          </Card>
          <Card>
            <CardTitle className="mb-1">Audit timeline</CardTitle>
            <CardHint className="mb-4">Handled by: {adminName(r.assigned_to)}</CardHint>
            <Timeline rows={[...rows].reverse()} showHash />
          </Card>
        </div>
      </div>
    </div>
  );
}
