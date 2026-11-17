"use server";

import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { analyze, findDuplicate } from "@/lib/ai";
import { appendAudit } from "@/lib/audit";
import { getAccessibleReport } from "@/lib/cases";
import { now } from "@/lib/clock";
import { ACTIVE_STATUSES, MAX_REPORTS_PER_MONTH } from "@/lib/constants";
import { anonIdFor, encrypt, genCaseCode, genPassphrase, sha256 } from "@/lib/crypto";
import { getErpAdapter } from "@/lib/erp/adapter";
import { deadlineFor, escalate } from "@/lib/escalation";
import { clearSession, getSession, setSession } from "@/lib/session";
import { serviceDb } from "@/lib/supabase/service";

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

// ---------- auth ----------
export async function erpLogin(rollNo: string, password: string): Promise<Result> {
  if (!rollNo?.trim() || !password) return { ok: false, error: "Enter your roll number and password." };
  const res = await getErpAdapter().verify(rollNo, password);
  if (!res.ok || !res.rollNo) return { ok: false, error: "Those ERP details didn't match. Please try again." };
  // From here on, only the one-way anonymous id exists. The roll number is dropped.
  const prev = await getSession();
  await setSession({ anon_id: anonIdFor(res.rollNo), cases: prev?.cases ?? [] });
  return { ok: true };
}

export async function caseLogin(code: string, passphrase: string): Promise<Result<{ code: string }>> {
  const c = code?.trim().toUpperCase();
  if (!c || !passphrase?.trim()) return { ok: false, error: "Enter your case code and passphrase." };
  const { data: r } = await serviceDb()
    .from("reports")
    .select("id, case_code, passphrase_hash")
    .eq("case_code", c)
    .maybeSingle();
  const ok = r ? await bcrypt.compare(passphrase.trim().toLowerCase(), r.passphrase_hash) : false;
  if (!r || !ok) return { ok: false, error: "That case code and passphrase don't match." };
  const prev = await getSession();
  await setSession({ anon_id: prev?.anon_id, cases: [...new Set([...(prev?.cases ?? []), r.id])] });
  return { ok: true, code: r.case_code };
}

export async function logout() {
  clearSession();
}

// ---------- submit a report ----------
export async function submitReport(
  form: FormData
): Promise<Result<{ code: string; passphrase: string; selfHarm: boolean; duplicate: boolean }>> {
  const session = await getSession();
  if (!session?.anon_id) return { ok: false, error: "Your session has ended. Please log in with ERP again." };
  const anon_id = session.anon_id;

  const text = String(form.get("text") ?? "").trim();
  if (text.length < 10) return { ok: false, error: "Please describe what happened in a little more detail." };
  const location = String(form.get("location") ?? "") || undefined;
  const time_of_day = String(form.get("time_of_day") ?? "") || undefined;
  const files = form.getAll("evidence").filter((f): f is File => f instanceof File && f.size > 0);

  const db = serviceDb();
  const at = await now();
  const month = at.toISOString().slice(0, 7);

  const { data: rl } = await db.from("rate_limits").select("count").eq("anon_id", anon_id).eq("month", month).maybeSingle();
  if ((rl?.count ?? 0) >= MAX_REPORTS_PER_MONTH)
    return {
      ok: false,
      error: `You've filed ${MAX_REPORTS_PER_MONTH} reports this month, which is the limit. This keeps the system trustworthy for everyone. You can still follow up on your existing cases, and in an emergency please contact campus security directly.`,
    };

  const a = await analyze({ text, location, time_of_day });

  // A claim already dismissed for the same accused + location needs new evidence to be refiled.
  if (a.accused_descriptor && files.length === 0) {
    const { data: dismissed } = await db
      .from("reports")
      .select("id")
      .eq("status", "dismissed")
      .eq("location", a.location)
      .ilike("accused_descriptor", a.accused_descriptor.replace(/[%_,]/g, " "))
      .limit(1);
    if (dismissed?.length)
      return {
        ok: false,
        error:
          "A similar report about the same people at this location was reviewed and dismissed earlier. You can file it again if you attach new evidence, such as a photo, screenshot or voice note.",
      };
  }

  // Duplicate check against the last 30 open reports at the same location.
  let duplicate_of: string | null = null;
  const { data: candidates } = await db
    .from("reports")
    .select("id, scrubbed_summary, accused_descriptor, time_of_day, plus_one_count")
    .eq("location", a.location)
    .in("status", ACTIVE_STATUSES)
    .is("duplicate_of", null)
    .order("created_at", { ascending: false })
    .limit(30);
  if (candidates?.length) duplicate_of = await findDuplicate(a.scrubbed_summary, a.accused_descriptor, candidates);

  const passphrase = genPassphrase();
  const passphrase_hash = await bcrypt.hash(passphrase, 10);
  let report: any = null;
  for (let attempt = 0; attempt < 5 && !report; attempt++) {
    const { data, error } = await db
      .from("reports")
      .insert({
        case_code: genCaseCode(),
        passphrase_hash,
        anon_id,
        raw_text_encrypted: encrypt(text),
        scrubbed_summary: a.scrubbed_summary,
        category: a.category,
        urgency: a.urgency,
        spam_score: a.spam_score,
        self_harm_flag: a.self_harm_flag,
        location: a.location,
        time_of_day: a.time_of_day,
        accused_descriptor: a.accused_descriptor,
        status: "open",
        escalation_level: 0,
        deadline_at: deadlineFor(a.urgency, at).toISOString(),
        duplicate_of,
        created_at: at.toISOString(),
      })
      .select("id, case_code")
      .single();
    if (data) report = data;
    else if (error && error.code !== "23505") return { ok: false, error: "Could not save your report. Please try again." };
  }
  if (!report) return { ok: false, error: "Could not save your report. Please try again." };

  await appendAudit(db, {
    report_id: report.id,
    event_type: "report_submitted",
    payload: { category: a.category, urgency: a.urgency, evidence_count: files.length },
    actor: "reporter",
    at,
  });

  for (const f of files.slice(0, 6)) {
    const buf = Buffer.from(await f.arrayBuffer());
    const hash = sha256(buf);
    const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
    const path = `${report.id}/${randomUUID()}-${safe}`;
    const up = await db.storage.from("evidence").upload(path, buf, { contentType: f.type || "application/octet-stream" });
    if (up.error) continue;
    await db.from("evidence").insert({
      report_id: report.id,
      storage_path: path,
      file_name: safe,
      mime_type: f.type,
      sha256: hash,
      uploaded_at: at.toISOString(),
    });
    await appendAudit(db, {
      report_id: report.id,
      event_type: "evidence_added",
      payload: { file: safe, sha256: hash },
      actor: "reporter",
      at,
    });
  }

  if (a.self_harm_flag)
    await appendAudit(db, { report_id: report.id, event_type: "counselor_alerted", payload: {}, actor: "system", at });

  if (duplicate_of) {
    const orig = candidates!.find((c) => c.id === duplicate_of)!;
    await db.from("reports").update({ plus_one_count: (orig.plus_one_count ?? 0) + 1 }).eq("id", duplicate_of);
    await appendAudit(db, { report_id: duplicate_of, event_type: "plus_one", payload: {}, actor: "system", at });
    await appendAudit(db, { report_id: report.id, event_type: "duplicate_linked", payload: {}, actor: "system", at });
  }

  await db.from("rate_limits").upsert({ anon_id, month, count: (rl?.count ?? 0) + 1 });

  return { ok: true, code: report.case_code, passphrase, selfHarm: a.self_harm_flag, duplicate: !!duplicate_of };
}

// ---------- chat ----------
export async function getMessages(code: string) {
  const r = await getAccessibleReport(code);
  if (!r) return [];
  const { data } = await serviceDb()
    .from("messages")
    .select("id, sender, body, created_at")
    .eq("report_id", r.id)
    .order("created_at");
  return data ?? [];
}

export async function sendMessage(code: string, body: string): Promise<Result> {
  const r = await getAccessibleReport(code);
  if (!r) return { ok: false, error: "Case not found." };
  const text = body.trim().slice(0, 2000);
  if (!text) return { ok: false, error: "Message is empty." };
  await serviceDb()
    .from("messages")
    .insert({ report_id: r.id, sender: "reporter", body: text, created_at: (await now()).toISOString() });
  return { ok: true };
}

// ---------- closure confirmation ----------
export async function respondClosure(code: string, accept: boolean): Promise<Result> {
  const r = await getAccessibleReport(code);
  if (!r) return { ok: false, error: "Case not found." };
  if (r.status !== "pending_confirmation") return { ok: false, error: "This case is not waiting for your confirmation." };
  const db = serviceDb();
  const at = await now();
  if (accept) {
    await db
      .from("reports")
      .update({ status: "closed", closed_at: at.toISOString(), closed_with_acceptance: true })
      .eq("id", r.id);
    await appendAudit(db, { report_id: r.id, event_type: "closure_accepted", payload: {}, actor: "reporter", at });
    await db.from("followups").insert(
      [7, 30].map((d) => ({ report_id: r.id, due_at: new Date(at.getTime() + d * 86400_000).toISOString() }))
    );
  } else {
    await appendAudit(db, { report_id: r.id, event_type: "closure_rejected", payload: {}, actor: "reporter", at });
    await escalate(db, r, "closure_rejected", at, { status: "reopened", reopen_count: (r.reopen_count ?? 0) + 1 });
  }
  revalidatePath(`/case/${r.case_code}`);
  return { ok: true };
}

// ---------- silent follow-up ----------
export async function answerFollowup(code: string, followupId: string, stopped: boolean): Promise<Result> {
  const r = await getAccessibleReport(code);
  if (!r) return { ok: false, error: "Case not found." };
  const db = serviceDb();
  const at = await now();
  const { data: f } = await db
    .from("followups")
    .update({ answered: true, answer: stopped ? "stopped" : "not_stopped" })
    .eq("id", followupId)
    .eq("report_id", r.id)
    .eq("answered", false)
    .select("id")
    .maybeSingle();
  if (!f) return { ok: false, error: "This follow-up was already answered." };
  await appendAudit(db, {
    report_id: r.id,
    event_type: "followup_answered",
    payload: { answer: stopped ? "stopped" : "not_stopped" },
    actor: "reporter",
    at,
  });
  if (!stopped) {
    await escalate(db, r, "followup_not_stopped", at, {
      status: "reopened",
      reopen_count: (r.reopen_count ?? 0) + 1,
      closed_at: null,
    });
  }
  revalidatePath(`/case/${r.case_code}`);
  return { ok: true };
}
