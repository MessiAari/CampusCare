import "server-only";
import { redirect } from "next/navigation";
import { ROLE_LEVEL } from "./constants";
import { adminDb } from "./supabase/server";

export type Admin = { id: string; name: string; role: "committee" | "dean" | "external"; level: number };

/** Columns an admin is allowed to read. anon_id, raw text and passphrase hash are not grantable. */
export const ADMIN_REPORT_COLS =
  "id, case_code, scrubbed_summary, category, urgency, spam_score, self_harm_flag, location, time_of_day, accused_descriptor, status, escalation_level, deadline_at, assigned_to, duplicate_of, plus_one_count, reopen_count, created_at, closed_at, closed_with_acceptance";

export async function requireAdmin(): Promise<Admin> {
  const sb = adminDb();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect("/admin/login");
  const { data } = await sb.from("admins").select("id, name, role").eq("id", user.id).maybeSingle();
  if (!data) redirect("/admin/login?e=not-admin");
  return { ...(data as any), level: ROLE_LEVEL[data.role] ?? 0 };
}
