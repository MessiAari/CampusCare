import { InboxTable } from "@/components/admin/InboxTable";
import { ADMIN_REPORT_COLS, requireAdmin } from "@/lib/admin";
import { now } from "@/lib/clock";
import { adminDb } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const admin = await requireAdmin();
  // Read with the admin's own session: RLS and column grants apply.
  const { data, error } = await adminDb()
    .from("reports")
    .select(ADMIN_REPORT_COLS)
    .order("created_at", { ascending: false })
    .limit(500);

  return (
    <div>
      <h1 className="text-2xl font-extrabold">Inbox</h1>
      <p className="mt-1 text-sm text-navy/60">Every case has a deadline. Overdue cases move up a level automatically.</p>
      {error ? (
        <p className="mt-6 rounded-2xl bg-danger-100 p-4 text-sm text-danger">Could not load cases: {error.message}</p>
      ) : (
        <InboxTable reports={(data as any[]) ?? []} serverNow={(await now()).toISOString()} adminLevel={admin.level} />
      )}
    </div>
  );
}
