// Seeds demo data: 6 mock ERP students, 3 admins and ~30 reports. Wipes existing case data first.
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { computeHash, GENESIS } from "../src/lib/audit";
import { DEADLINE_HOURS, type Urgency } from "../src/lib/constants";
import { anonIdFor, encrypt } from "../src/lib/crypto";
import { DEMO_ADMINS, DEMO_PASSWORD, DEMO_STUDENTS } from "../src/lib/demo";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

// Small deterministic RNG so every seed looks the same.
let s = 42;
const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
const between = (a: number, b: number) => a + rnd() * (b - a);
const H = 3600_000;
const D = 24 * H;

const SENIORS_A = "a group of four final-year students from the mechanical branch";
const WARDEN_B = "the night warden of Hostel B";
const CANTEEN = "two canteen staff members at the main counter";

type Status = "open" | "in_progress" | "pending_confirmation" | "closed" | "reopened" | "dismissed";
type Seed = {
  loc: string; time: string; cat: string; urg: Urgency; accused: string | null; status: Status;
  summary: string; level?: number; reopens?: number; plus?: number; spam?: number; selfHarm?: boolean;
  vagueProof?: boolean; soon?: boolean;
};

const R: Seed[] = [
  // Hostel A at night: the hotspot.
  { loc: "Hostel A", time: "night", cat: "ragging", urg: "high", accused: SENIORS_A, status: "open", plus: 2, summary: "The reporter states that first-year residents were called to the third-floor common room after midnight and made to stand for over an hour while being verbally abused.\nThe accused are described as a group of four final-year students from the mechanical branch.\nThe reporter says this has happened on several nights this month." },
  { loc: "Hostel A", time: "night", cat: "ragging", urg: "high", accused: SENIORS_A, status: "in_progress", summary: "The reporter states that juniors were forced to do push-ups and recite introductions in the corridor late at night.\nThe accused are described as a group of four final-year students from the mechanical branch.\nOne junior was reportedly not allowed to return to his room until 2 am." },
  { loc: "Hostel A", time: "night", cat: "ragging", urg: "critical", accused: SENIORS_A, status: "reopened", level: 1, reopens: 1, vagueProof: true, summary: "The reporter states that a first-year student was slapped and had water thrown on his bedding after refusing to run errands for seniors.\nThe accused are described as a group of four final-year students from the mechanical branch.\nThe reporter says the student is now afraid to stay in the hostel." },
  { loc: "Hostel A", time: "night", cat: "bullying", urg: "normal", accused: "a second-year resident on the same floor", status: "closed", summary: "The reporter states that loud music and banging on doors after midnight is used to intimidate residents who complain.\nThe accused is described as a second-year resident on the same floor." },
  { loc: "Hostel A", time: "night", cat: "ragging", urg: "high", accused: "three seniors from the hostel mess committee", status: "closed", summary: "The reporter states that first-years were made to serve food and clean tables for seniors after the mess closed.\nThe accused are described as three seniors from the hostel mess committee." },
  { loc: "Hostel A", time: "night", cat: "ragging", urg: "high", accused: SENIORS_A, status: "pending_confirmation", vagueProof: true, summary: "The reporter states that phones of several juniors were taken away during a late-night 'intro session' and returned only the next morning.\nThe accused are described as a group of four final-year students from the mechanical branch." },
  { loc: "Hostel A", time: "evening", cat: "bullying", urg: "normal", accused: null, status: "closed", summary: "The reporter states that a resident is repeatedly mocked for his accent in the common room in the evenings.\nNo specific person is described." },
  { loc: "Hostel A", time: "evening", cat: "grievance", urg: "normal", accused: null, status: "open", summary: "The reporter states that the hostel entry register is left unattended in the evenings and outsiders enter freely." },
  // Hostel B
  { loc: "Hostel B", time: "night", cat: "sexual harassment", urg: "critical", accused: WARDEN_B, status: "in_progress", level: 1, soon: true, summary: "The reporter states that a staff member makes inappropriate comments during night attendance and has entered rooms without knocking.\nThe accused is described as the night warden of Hostel B.\nThe reporter says several residents feel unsafe." },
  { loc: "Hostel B", time: "night", cat: "sexual harassment", urg: "high", accused: WARDEN_B, status: "open", summary: "The reporter states that a staff member asked personal questions about a resident's relationships during a late-night room check.\nThe accused is described as the night warden of Hostel B." },
  { loc: "Hostel B", time: "night", cat: "grievance", urg: "normal", accused: null, status: "closed", summary: "The reporter states that corridor lights on the second floor have not worked for weeks, making it unsafe to walk at night." },
  { loc: "Hostel B", time: "morning", cat: "discrimination", urg: "high", accused: "a mess supervisor", status: "closed", reopens: 1, level: 1, summary: "The reporter states that students from a particular region are served last and spoken to rudely at breakfast.\nThe accused is described as a mess supervisor." },
  { loc: "Hostel C", time: "night", cat: "bullying", urg: "normal", accused: null, status: "open", summary: "The reporter states that a group chat is being used to circulate edited photos of a resident." },
  { loc: "Hostel C", time: "evening", cat: "other", urg: "normal", accused: null, status: "dismissed", summary: "The reporter states that a roommate does not clean the shared room." },
  // Canteen in the afternoon: second cluster.
  { loc: "Canteen", time: "afternoon", cat: "discrimination", urg: "high", accused: CANTEEN, status: "in_progress", summary: "The reporter states that staff refused to serve a student and made remarks about his caste in front of others.\nThe accused are described as two canteen staff members at the main counter." },
  { loc: "Canteen", time: "afternoon", cat: "discrimination", urg: "normal", accused: CANTEEN, status: "closed", summary: "The reporter states that staff routinely overcharge students who do not speak the local language.\nThe accused are described as two canteen staff members at the main counter." },
  { loc: "Canteen", time: "afternoon", cat: "bullying", urg: "normal", accused: "a group of third-year students", status: "closed", summary: "The reporter states that a group occupies tables and forces juniors to give up their seats and food.\nThe accused are described as a group of third-year students." },
  { loc: "Canteen", time: "afternoon", cat: "grievance", urg: "normal", accused: null, status: "open", summary: "The reporter states that stale food was served twice this week and complaints at the counter were ignored." },
  { loc: "Canteen", time: "evening", cat: "other", urg: "normal", accused: null, status: "open", spam: 0.88, summary: "The reporter writes a short message with no incident described, apparently testing the form." },
  // Library
  { loc: "Library", time: "evening", cat: "sexual harassment", urg: "high", accused: "a research scholar who sits near the reference section", status: "in_progress", summary: "The reporter states that a man repeatedly follows a student between the shelves and sits uncomfortably close despite being asked to stop.\nThe accused is described as a research scholar who sits near the reference section." },
  { loc: "Library", time: "evening", cat: "sexual harassment", urg: "high", accused: "a research scholar who sits near the reference section", status: "open", summary: "The reporter states that a man took photos of students in the reading hall without consent.\nThe accused is described as a research scholar who sits near the reference section." },
  { loc: "Library", time: "evening", cat: "bullying", urg: "normal", accused: null, status: "closed", summary: "The reporter states that a student's notes were deliberately hidden and torn before an exam." },
  { loc: "Library", time: "afternoon", cat: "grievance", urg: "normal", accused: null, status: "closed", summary: "The reporter states that library staff deny entry to students without a printed ID even when the digital ID is shown." },
  // Bus stop
  { loc: "Bus Stop", time: "evening", cat: "sexual harassment", urg: "critical", accused: "men on motorcycles who wait near the college bus stop", status: "reopened", level: 2, reopens: 2, vagueProof: true, summary: "The reporter states that students waiting for the evening bus are followed and catcalled, and one student was grabbed by the arm.\nThe accused are described as men on motorcycles who wait near the college bus stop." },
  { loc: "Bus Stop", time: "evening", cat: "sexual harassment", urg: "high", accused: "men on motorcycles who wait near the college bus stop", status: "open", summary: "The reporter states that the same men pass lewd comments at students boarding the 6 pm bus.\nThe accused are described as men on motorcycles who wait near the college bus stop." },
  { loc: "Bus Stop", time: "evening", cat: "grievance", urg: "normal", accused: null, status: "closed", summary: "The reporter states that the bus stop has no lighting and the security booth is unmanned after 5 pm." },
  { loc: "Bus Stop", time: "morning", cat: "bullying", urg: "normal", accused: null, status: "dismissed", summary: "The reporter states that seniors do not let juniors board the first bus." },
  // Elsewhere
  { loc: "Academic Block", time: "morning", cat: "discrimination", urg: "high", accused: "a faculty member in the electronics department", status: "in_progress", summary: "The reporter states that a teacher repeatedly singles out female students with remarks that they 'do not belong in the lab'.\nThe accused is described as a faculty member in the electronics department." },
  { loc: "Academic Block", time: "afternoon", cat: "grievance", urg: "normal", accused: null, status: "closed", summary: "The reporter states that internal marks were changed after publication with no explanation given." },
  { loc: "Online", time: "night", cat: "bullying", urg: "critical", accused: "an anonymous account followed by many batchmates", status: "open", selfHarm: true, summary: "The reporter states that an anonymous page is posting humiliating memes about a classmate, who has told friends she does not want to go on living.\nThe accused is described as an anonymous account followed by many batchmates." },
  { loc: "Sports Ground", time: "evening", cat: "ragging", urg: "high", accused: "senior members of the football team", status: "closed", summary: "The reporter states that new players were made to run punishment laps until one fainted.\nThe accused are described as senior members of the football team." },
  { loc: "Other", time: "afternoon", cat: "other", urg: "normal", accused: null, status: "open", spam: 0.93, summary: "The reporter submits a joke complaint about a friend with no real incident." },
];

const GOOD_PROOF = [
  "Committee met on the stated date and recorded statements from two witnesses. Written warning ref. DC/2026/118 issued to the students concerned, parents informed by letter, and the hostel warden has been assigned night rounds for four weeks.",
  "Inquiry completed. The staff member has been moved off student-facing duty by order HR/2026/41 pending a formal hearing, and CCTV footage for the three dates has been preserved with the security office.",
  "Maintenance work order MW-2291 completed and verified by the committee on site. Photographs attached. A monthly inspection has been added to the estate office checklist.",
];
const VAGUE_PROOF = "Matter resolved. Students were warned.";

async function main() {
  console.log("Clearing old demo data ...");
  await db.from("reports").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await db.from("rate_limits").delete().neq("anon_id", "");
  await db.from("erp_students").delete().neq("roll_no", "");
  await db.from("app_settings").upsert({ key: "clock_offset", value: { ms: 0 } });

  console.log("Seeding mock ERP students ...");
  const pwHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const { error: sErr } = await db.from("erp_students").insert(DEMO_STUDENTS.map((st) => ({ ...st, password_hash: pwHash })));
  if (sErr) throw new Error("erp_students: " + sErr.message + " (did you run `npm run db:setup`?)");

  console.log("Seeding admins ...");
  const adminIds: Record<string, string> = {};
  const { data: existing } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  for (const a of DEMO_ADMINS) {
    let id = existing?.users.find((u) => u.email === a.email)?.id;
    if (id) await db.auth.admin.updateUserById(id, { password: DEMO_PASSWORD, email_confirm: true });
    else {
      const { data, error } = await db.auth.admin.createUser({ email: a.email, password: DEMO_PASSWORD, email_confirm: true });
      if (error || !data.user) throw new Error(`auth user ${a.email}: ${error?.message}`);
      id = data.user.id;
    }
    adminIds[a.role] = id;
    await db.from("admins").upsert({ id, name: a.name, role: a.role });
  }

  console.log("Seeding reports ...");
  const now = Date.now();
  // The first student is kept clean so the live demo login starts with no rate-limit history.
  const anon = DEMO_STUDENTS.slice(1).map((st) => anonIdFor(st.roll_no));
  const phraseHash = await bcrypt.hash("seeded-case-not-for-login", 4);
  const usedCodes = new Set<string>();
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const code = () => {
    for (;;) {
      let c = "CC-";
      for (let i = 0; i < 4; i++) c += alphabet[Math.floor(rnd() * alphabet.length)];
      if (!usedCodes.has(c)) return usedCodes.add(c), c;
    }
  };

  const reports: any[] = [];
  const audits: any[] = [];
  const proofs: any[] = [];
  const followups: any[] = [];
  const messages: any[] = [];

  R.forEach((r, i) => {
    const id = randomUUID();
    const level = r.level ?? 0;
    const window = DEADLINE_HOURS[r.urg] * H;
    const done = r.status === "closed" || r.status === "dismissed";
    const ageDays = done ? between(12, 40) : r.status === "open" ? between(0.1, 1.5) : between(1, 5) + level * 3;
    const created = now - ageDays * D;
    const handler = adminIds[i % 4 === 3 ? "dean" : "committee"];
    const assigned = r.status === "open" && level === 0 ? null : level === 2 ? adminIds.committee : handler;
    const resolveDays = between(2, 9) + (r.reopens ? 6 : 0);
    const closedAt = done ? Math.min(created + resolveDays * D, now - 2 * D) : null;

    const chain: { t: string; p: any; actor: string; at: number }[] = [];
    chain.push({ t: "report_submitted", p: { category: r.cat, urgency: r.urg, evidence_count: 0 }, actor: "reporter", at: created });
    if (r.selfHarm) chain.push({ t: "counselor_alerted", p: {}, actor: "system", at: created + 1000 });
    for (let k = 0; k < (r.plus ?? 0); k++) chain.push({ t: "plus_one", p: {}, actor: "system", at: created + (k + 1) * 5 * H });

    const addProof = (text: string, at: number, by: string, role: string) => {
      const flagged = text === VAGUE_PROOF;
      proofs.push({
        report_id: id, admin_id: by, description: text, ai_boilerplate_flag: flagged,
        ai_note: flagged ? "Too vague to verify: it does not say who acted, what was done, or when, and cites no document." : "Names specific actions and references that can be checked.",
        created_at: new Date(at).toISOString(),
      });
      chain.push({ t: "proof_added", p: { ai_flagged: flagged, has_file: false }, actor: role, at });
      chain.push({ t: "closure_requested", p: {}, actor: role, at: at + 10 * 60_000 });
    };

    if (r.status !== "open" || level > 0) chain.push({ t: "status_changed", p: { from: "open", to: "in_progress" }, actor: "committee", at: created + 6 * H });

    // Each earlier reopen: vague proof, reporter rejects, case moves up.
    const span = (closedAt ?? now) - created;
    for (let k = 0; k < (r.reopens ?? 0); k++) {
      const at = created + span * (0.25 + 0.25 * k);
      addProof(VAGUE_PROOF, at, adminIds.committee, k === 0 ? "committee" : "dean");
      chain.push({ t: "closure_rejected", p: {}, actor: "reporter", at: at + 5 * H });
      chain.push({ t: "escalated", p: { from: k, to: Math.min(2, k + 1), reason: "closure_rejected" }, actor: "system", at: at + 5 * H + 1000 });
    }
    // Level reached without a rejection means a missed deadline.
    for (let k = r.reopens ?? 0; k < level; k++)
      chain.push({ t: "escalated", p: { from: k, to: k + 1, reason: "deadline_missed" }, actor: "system", at: created + window * (k + 1) });

    if (r.status === "pending_confirmation") addProof(r.vagueProof ? VAGUE_PROOF : GOOD_PROOF[i % 3], now - 3 * H, handler, "committee");
    if (r.status === "closed") {
      addProof(GOOD_PROOF[i % 3], closedAt! - 8 * H, handler, level ? "dean" : "committee");
      chain.push({ t: "closure_accepted", p: {}, actor: "reporter", at: closedAt! });
      for (const d of [7, 30]) {
        const due = closedAt! + d * D;
        followups.push({ report_id: id, due_at: new Date(due).toISOString(), answered: due < now, answer: due < now ? "stopped" : null });
      }
    }
    if (r.status === "dismissed") chain.push({ t: "dismissed", p: { from: "in_progress", to: "dismissed" }, actor: "committee", at: closedAt! });

    let prev = GENESIS;
    chain.sort((a, b) => a.at - b.at).forEach((e) => {
      const created_at = new Date(e.at).toISOString();
      const hash = computeHash(prev, e.t, e.p, created_at);
      audits.push({ report_id: id, event_type: e.t, payload: e.p, actor: e.actor, prev_hash: prev, hash, created_at });
      prev = hash;
    });

    if (r.status === "in_progress" && i % 2 === 0) {
      messages.push({ report_id: id, sender: "admin", body: "Thank you for reporting this. Could you tell us roughly which dates this happened on?", created_at: new Date(created + 8 * H).toISOString() });
      messages.push({ report_id: id, sender: "reporter", body: "Mostly on weekends, the last two Saturdays for sure.", created_at: new Date(created + 20 * H).toISOString() });
    }

    const remaining = r.soon ? 5 * H : window * between(0.25, 0.9);
    reports.push({
      id,
      case_code: code(),
      passphrase_hash: phraseHash,
      anon_id: anon[i % anon.length],
      raw_text_encrypted: encrypt("[Seeded demo report] " + r.summary.replace(/The reporter states that /g, "")),
      scrubbed_summary: r.summary,
      category: r.cat,
      urgency: r.urg,
      spam_score: r.spam ?? Math.round(between(0.02, 0.2) * 100) / 100,
      self_harm_flag: !!r.selfHarm,
      location: r.loc,
      time_of_day: r.time,
      accused_descriptor: r.accused,
      status: r.status,
      escalation_level: level,
      deadline_at: new Date(done ? closedAt! : r.status === "pending_confirmation" ? now + window * 0.5 : now + remaining).toISOString(),
      assigned_to: assigned,
      plus_one_count: r.plus ?? 0,
      reopen_count: r.reopens ?? 0,
      created_at: new Date(created).toISOString(),
      closed_at: closedAt ? new Date(closedAt).toISOString() : null,
      closed_with_acceptance: r.status === "closed" ? true : r.status === "dismissed" ? false : null,
    });
  });

  const ins = async (table: string, rows: any[]) => {
    if (!rows.length) return;
    const { error } = await db.from(table).insert(rows);
    if (error) throw new Error(`${table}: ${error.message}`);
  };
  await ins("reports", reports);
  await ins("audit_log", audits);
  await ins("proof_of_action", proofs);
  await ins("followups", followups);
  await ins("messages", messages);

  console.log(`\nSeeded ${DEMO_STUDENTS.length} students, ${DEMO_ADMINS.length} admins, ${reports.length} reports, ${audits.length} audit rows.`);
  console.log("Student login: any roll number in src/lib/demo.ts (e.g. " + DEMO_STUDENTS[0].roll_no + ")");
  console.log("Admin logins:  " + DEMO_ADMINS.map((a) => a.email).join(", "));
  console.log("Password for all demo accounts: see DEMO_PASSWORD in src/lib/demo.ts (or SEED_PASSWORD).");
}

main().catch((e) => {
  console.error("\nSeed failed:", e.message);
  process.exit(1);
});
