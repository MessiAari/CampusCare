import "server-only";
import { getSession } from "./session";
import { serviceDb } from "./supabase/service";

/** Returns the report only if this browser session owns it (ERP login) or unlocked it (passphrase). */
export async function getAccessibleReport(code: string) {
  const s = await getSession();
  if (!s) return null;
  const { data: r } = await serviceDb()
    .from("reports")
    .select("*")
    .eq("case_code", decodeURIComponent(code).trim().toUpperCase())
    .maybeSingle();
  if (!r) return null;
  if ((s.anon_id && r.anon_id === s.anon_id) || s.cases?.includes(r.id)) return r;
  return null;
}
