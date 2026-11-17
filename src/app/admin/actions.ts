"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin, type Admin } from "@/lib/admin";
import { checkProof } from "@/lib/ai";
import { appendAudit } from "@/lib/audit";
import { getOffsetMs, now, setOffsetMs } from "@/lib/clock";
import { ACTIVE_STATUSES, LEVEL_NAMES } from "@/lib/constants";
import { decrypt } from "@/lib/crypto";
import { isDemo } from "@/lib/demo";
import { checkEscalations } from "@/lib/escalation";
import { serviceDb } from "@/lib/supabase/service";

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

const REPORT_COLS = "id, case_code, status, escalation_level, urgency, assigned_to, scrubbed_summary, raw_text_encrypted";

/** Loads the case and checks the admin's role is senior enough for its current escalation level. */
async function loadForAction(reportId: string): Promise<{ admin: Admin; report: any; error?: string }> {
  const admin = await requireAdmin();
  const { data: report } = await serviceDb().from("reports").select(REPORT_COLS).eq("id", reportId).maybeSingle();
  if (!report) return { admin, report: null, error: "Case not found." };
  if (admin.level < report.escalation_level)
    return {
      admin,
      report,
      error: `This case has been escalated to the ${LEVEL_NAMES[report.escalation_level]}. Your role can view it but not act on it.`,
    };
  return { admin, report };
}

function refresh(reportId: string) {
  revalidatePath(`/admin/case/${reportId}`);
  revalidatePath("/admin");
}

export async function getAdminMessages(reportId: string) {
  await requireAdmin();
  const { data } = await serviceDb()
    .from("messages")
    .select("id, sender, body, created_at")
    .eq("report_id", reportId)
    .order("created_at");
  return data ?? [];
}

export async function sendAdminMessage(reportId: string, body: string): Promise<Result> {
  const { admin, report, error } = await loadForAction(reportId);
  if (error) return { ok: false, error };
  const text = body.trim().slice(0, 2000);
  if (!text) return { ok: false, error: "Message is empty." };
  const db = serviceDb();
  await db.from("messages").insert({ report_id: reportId, sender: "admin", body: text, created_at: (await now()).toISOString() });
  if (!report.assigned_to) await db.from("reports").update({ assigned_to: admin.id }).eq("id", reportId);
  return { ok: true };
}

export async function setStatus(reportId: string, status: "in_progress" | "dismissed"): Promise<Result> {
  const { admin, report, error } = await loadForAction(reportId);
  if (error) return { ok: false, error };
  if (!ACTIVE_STATUSES.includes(report.status)) return { ok: false, error: "This case can't be changed right now." };
  const db = serviceDb();
  const at = await now();
  await db
    .from("reports")
    .update({
      status,
      assigned_to: report.assigned_to ?? admin.id,
      ...(status === "dismissed" ? { closed_at: at.toISOString(), closed_with_acceptance: false } : {}),
    })
    .eq("id", reportId);
  await appendAudit(db, {
    report_id: reportId,
    event_type: status === "dismissed" ? "dismissed" : "status_changed",
    payload: { from: report.status, to: status },
    actor: admin.role,
    at,
  });
  refresh(reportId);
  return { ok: true };
}

export async function addProof(form: FormData): Promise<Result<{ flagged: boolean; note: string }>> {
  const reportId = String(form.get("reportId") ?? "");
  const description = String(form.get("description") ?? "").trim();
  const file = form.get("file");
  const { admin, report, error } = await loadForAction(reportId);
  if (error) return { ok: false, error };
  if (description.length < 3) return { ok: false, error: "Describe the action that was taken." };
  if (!ACTIVE_STATUSES.includes(report.status)) return { ok: false, error: "Proof can only be added to an active case." };

  const db = serviceDb();
  const at = await now();
  let file_path: string | null = null;
  if (file instanceof File && file.size > 0) {
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
    const path = `${reportId}/${randomUUID()}-${safe}`;
    const up = await db.storage
      .from("proof")
      .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type || "application/octet-stream" });
    if (!up.error) file_path = path;
  }

  const check = await checkProof(description, report.scrubbed_summary);
  await db.from("proof_of_action").insert({
    report_id: reportId,
    admin_id: admin.id,
    description,
    file_path,
    ai_boilerplate_flag: check.boilerplate,
    ai_note: check.note,
    created_at: at.toISOString(),
  });
  await db
    .from("reports")
    .update({ assigned_to: report.assigned_to ?? admin.id, status: "in_progress" })
    .eq("id", reportId);
  await appendAudit(db, {
    report_id: reportId,
    event_type: "proof_added",
    payload: { ai_flagged: check.boilerplate, has_file: !!file_path },
    actor: admin.role,
    at,
  });
  refresh(reportId);
  return { ok: true, flagged: check.boilerplate, note: check.note };
}

export async function requestClosure(reportId: string): Promise<Result> {
  const { admin, report, error } = await loadForAction(reportId);
  if (error) return { ok: false, error };
  if (!ACTIVE_STATUSES.includes(report.status)) return { ok: false, error: "This case is not active." };
  const db = serviceDb();
  const { count } = await db.from("proof_of_action").select("id", { count: "exact", head: true }).eq("report_id", reportId);
  if (!count) return { ok: false, error: "Add proof of action before requesting closure." };
  const at = await now();
  await db.from("reports").update({ status: "pending_confirmation" }).eq("id", reportId);
  await appendAudit(db, { report_id: reportId, event_type: "closure_requested", payload: {}, actor: admin.role, at });
  refresh(reportId);
  return { ok: true };
}

/** Decrypts the reporter's original words. Always leaves a trace the reporter can see. */
export async function viewOriginal(reportId: string): Promise<Result<{ text: string }>> {
  const { admin, report, error } = await loadForAction(reportId);
  if (error) return { ok: false, error };
  await appendAudit(serviceDb(), {
    report_id: reportId,
    event_type: "original_viewed",
    payload: { role: admin.role },
    actor: admin.role,
    at: await now(),
  });
  refresh(reportId);
  try {
    return { ok: true, text: decrypt(report.raw_text_encrypted) };
  } catch {
    return { ok: false, error: "The original text could not be decrypted with the current server key." };
  }
}

// ---------- demo controls (DEMO_MODE only) ----------
async function demoGuard() {
  await requireAdmin();
  if (!isDemo()) throw new Error("Demo mode is off.");
}

export async function demoFastForward(days: number): Promise<Result<{ escalated: number }>> {
  await demoGuard();
  await setOffsetMs((await getOffsetMs()) + days * 86400_000);
  const escalated = await checkEscalations();
  revalidatePath("/admin", "layout");
  return { ok: true, escalated };
}

export async function demoResetClock(): Promise<Result> {
  await demoGuard();
  await setOffsetMs(0);
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function demoTriggerFollowup(reportId: string): Promise<Result> {
  await demoGuard();
  const db = serviceDb();
  const at = (await now()).toISOString();
  const { data: f } = await db
    .from("followups")
    .select("id")
    .eq("report_id", reportId)
    .eq("answered", false)
    .order("due_at")
    .limit(1)
    .maybeSingle();
  if (f) await db.from("followups").update({ due_at: at }).eq("id", f.id);
  else await db.from("followups").insert({ report_id: reportId, due_at: at });
  refresh(reportId);
  return { ok: true };
}

/** Edits one audit row directly, the way someone with database access might. The chain check catches it. */
export async function demoTamper(reportId: string, undo = false): Promise<Result> {
  await demoGuard();
  const db = serviceDb();
  const { data: rows } = await db.from("audit_log").select("id, payload").eq("report_id", reportId).order("id");
  if (!rows?.length) return { ok: false, error: "No audit rows for this case." };
  if (undo) {
    for (const r of rows.filter((x) => "_edited" in (x.payload ?? {}))) {
      const { _edited, ...rest } = r.payload;
      await db.from("audit_log").update({ payload: rest }).eq("id", r.id);
    }
  } else {
    const target = rows[0];
    await db
      .from("audit_log")
      .update({ payload: { ...target.payload, _edited: "changed directly in the database" } })
      .eq("id", target.id);
  }
  refresh(reportId);
  return { ok: true };
}

export async function demoResetRateLimits(): Promise<Result> {
  await demoGuard();
  await serviceDb().from("rate_limits").delete().neq("anon_id", "");
  return { ok: true };
}
