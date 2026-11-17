import { SimpleBar } from "@/components/admin/Charts";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/admin";
import { LEVEL_NAMES, SPAM_THRESHOLD } from "@/lib/constants";
import { adminDb } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function stats(list: any[]) {
  const closed = list.filter((r) => r.status === "closed" && r.closed_at);
  const reopened = list.filter((r) => r.reopen_count > 0).length;
  const days = closed.map((r) => (+new Date(r.closed_at) - +new Date(r.created_at)) / 86400_000);
  return {
    handled: list.length,
    reopenRate: list.length ? Math.round((reopened / list.length) * 100) : 0,
    avgDays: days.length ? Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10 : 0,
    acceptance: closed.length ? Math.round((closed.filter((r) => r.closed_with_acceptance).length / closed.length) * 100) : 0,
    closed: closed.length,
  };
}

export default async function Accountability() {
  await requireAdmin();
  const sb = adminDb();
  const [{ data: rep }, { data: admins }] = await Promise.all([
    sb.from("reports").select("status, escalation_level, assigned_to, reopen_count, created_at, closed_at, closed_with_acceptance, spam_score").limit(2000),
    sb.from("admins").select("id, name, role"),
  ]);
  const reports = (rep ?? []).filter((r: any) => Number(r.spam_score) < SPAM_THRESHOLD) as any[];
  const overall = stats(reports);

  const perAdmin = (admins ?? [])
    .map((a) => ({ name: a.name.split(" ").slice(0, 3).join(" "), ...stats(reports.filter((r) => r.assigned_to === a.id)) }))
    .filter((a) => a.handled > 0);
  const perLevel = LEVEL_NAMES.map((n, i) => ({ name: n, ...stats(reports.filter((r) => r.escalation_level === i)) })).filter((l) => l.handled > 0);

  const tiles = [
    { label: "Cases handled", value: overall.handled, hint: "excluding spam-likely" },
    { label: "Reopen rate", value: overall.reopenRate + "%", hint: "reporter said it wasn't resolved", bad: overall.reopenRate > 25 },
    { label: "Avg. time to resolve", value: overall.avgDays + " days", hint: `${overall.closed} closed cases` },
    { label: "Closed with reporter's acceptance", value: overall.acceptance + "%", hint: "of closed cases" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">Accountability</h1>
        <p className="mt-1 text-sm text-navy/60">How well cases are being resolved, by person and by level. A high reopen rate means closures aren&apos;t sticking.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label}>
            <p className="text-xs font-semibold text-navy/50">{t.label}</p>
            <p className={`mt-1 font-heading text-3xl font-extrabold tabular-nums ${t.bad ? "text-danger" : ""}`}>{t.value}</p>
            <p className="text-xs text-navy/50">{t.hint}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle>Reopen rate by admin</CardTitle>
          <CardHint>Share of each admin&apos;s cases that were reopened. Above 25% is shown in red.</CardHint>
          <div className="mt-3">
            <SimpleBar data={perAdmin} dataKey="reopenRate" unit="%" highlightAbove={25} />
          </div>
        </Card>
        <Card>
          <CardTitle>Reopen rate by level</CardTitle>
          <CardHint>Cases grouped by the level they are currently with.</CardHint>
          <div className="mt-3">
            <SimpleBar data={perLevel} dataKey="reopenRate" unit="%" highlightAbove={25} />
          </div>
        </Card>
        <Card>
          <CardTitle>Average resolution time by admin</CardTitle>
          <CardHint>Days from report to accepted closure.</CardHint>
          <div className="mt-3">
            <SimpleBar data={perAdmin.filter((a) => a.closed > 0)} dataKey="avgDays" unit="d" color="#142D3A" />
          </div>
        </Card>
        <Card>
          <CardTitle>Closed with reporter&apos;s acceptance, by admin</CardTitle>
          <CardHint>Share of closed cases the reporter agreed were resolved.</CardHint>
          <div className="mt-3">
            <SimpleBar data={perAdmin.filter((a) => a.closed > 0)} dataKey="acceptance" unit="%" />
          </div>
        </Card>
      </div>

      <Card>
        <CardTitle>Detail</CardTitle>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-navy/50">
              <tr>
                <th className="py-2 font-semibold">Admin / level</th>
                <th className="py-2 text-right font-semibold">Cases</th>
                <th className="py-2 text-right font-semibold">Reopen rate</th>
                <th className="py-2 text-right font-semibold">Avg. days</th>
                <th className="py-2 text-right font-semibold">Accepted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/5 tabular-nums">
              {[...perAdmin, ...perLevel].map((r) => (
                <tr key={r.name}>
                  <td className="py-2.5 font-medium">{r.name}</td>
                  <td className="py-2.5 text-right">{r.handled}</td>
                  <td className={`py-2.5 text-right ${r.reopenRate > 25 ? "font-bold text-danger" : ""}`}>{r.reopenRate}%</td>
                  <td className="py-2.5 text-right">{r.closed ? r.avgDays : "–"}</td>
                  <td className="py-2.5 text-right">{r.closed ? r.acceptance + "%" : "–"}</td>
                </tr>
              ))}
              {perAdmin.length + perLevel.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-navy/50">
                    No cases yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
