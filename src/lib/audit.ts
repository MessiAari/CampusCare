// Hash-chained audit log. Each report has its own chain.
// hash = sha256(prev_hash + event_type + JSON(payload) + created_at)
import type { SupabaseClient } from "@supabase/supabase-js";
import { sha256 } from "./crypto";

export const GENESIS = "GENESIS";

/** Key-sorted JSON so the hash does not depend on how Postgres orders jsonb keys. */
export function canonical(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  const o = v as Record<string, unknown>;
  return (
    "{" +
    Object.keys(o)
      .sort()
      .map((k) => JSON.stringify(k) + ":" + canonical(o[k]))
      .join(",") +
    "}"
  );
}

export function computeHash(prev: string, eventType: string, payload: unknown, createdAt: string | Date) {
  return sha256(prev + eventType + canonical(payload) + new Date(createdAt).toISOString());
}

export type AuditRow = {
  id: number;
  report_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  actor: string;
  prev_hash: string;
  hash: string;
  created_at: string;
};

export async function appendAudit(
  db: SupabaseClient,
  e: { report_id: string; event_type: string; payload?: Record<string, unknown>; actor: string; at: Date }
) {
  const { data: last } = await db
    .from("audit_log")
    .select("hash")
    .eq("report_id", e.report_id)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  const prev = last?.hash ?? GENESIS;
  const payload = e.payload ?? {};
  const created_at = e.at.toISOString();
  const hash = computeHash(prev, e.event_type, payload, created_at);
  const { error } = await db.from("audit_log").insert({
    report_id: e.report_id,
    event_type: e.event_type,
    payload,
    actor: e.actor,
    prev_hash: prev,
    hash,
    created_at,
  });
  if (error) throw new Error("audit insert failed: " + error.message);
}

/** Recompute the chain. Rows must be for one report, ordered by id ascending. */
export function verifyChain(rows: AuditRow[]): { ok: boolean; brokenAt: number | null } {
  let prev = GENESIS;
  for (const r of rows) {
    if (r.prev_hash !== prev) return { ok: false, brokenAt: r.id };
    if (computeHash(prev, r.event_type, r.payload, r.created_at) !== r.hash)
      return { ok: false, brokenAt: r.id };
    prev = r.hash;
  }
  return { ok: true, brokenAt: null };
}
