import { SimpleBar } from "@/components/admin/Charts";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/admin";
import { CATEGORIES, K_ANONYMITY, LOCATIONS, SPAM_THRESHOLD, TIMES } from "@/lib/constants";
import { adminDb } from "@/lib/supabase/server";
import { titleCase } from "@/lib/utils";

export const dynamic = "force-dynamic";

function cellStyle(n: number, max: number): React.CSSProperties {
  const t = max > 0 ? n / max : 0;
  // Sequential single-hue ramp: mint -> teal -> navy.
  const bg = t > 0.75 ? "#142D3A" : t > 0.5 ? "#126A60" : t > 0.25 ? "#3E9C90" : "#9CCFC6";
  return { backgroundColor: bg, color: t > 0.25 ? "#fff" : "#142D3A" };
}

export default async function Hotspots() {
  await requireAdmin();
  const { data } = await adminDb()
    .from("reports")
    .select("location, time_of_day, category, accused_descriptor, spam_score, status, duplicate_of")
    .limit(2000);
  // Spam-likely, dismissed and duplicate (+1) reports are left out so one incident counts once.
  const reports = (data ?? []).filter(
    (r: any) => Number(r.spam_score) < SPAM_THRESHOLD && r.status !== "dismissed" && !r.duplicate_of
  ) as any[];

  const grid: Record<string, Record<string, number>> = {};
  for (const r of reports) {
    if (!r.location || !r.time_of_day) continue;
    (grid[r.location] ??= {})[r.time_of_day] = (grid[r.location][r.time_of_day] ?? 0) + 1;
  }
  const locations = LOCATIONS.filter((l) => grid[l]);
  const max = Math.max(0, ...locations.flatMap((l) => Object.values(grid[l])));
  let top: { loc: string; time: string; n: number } | null = null;
  for (const l of locations)
    for (const t of TIMES) {
      const n = grid[l][t] ?? 0;
      if (n >= K_ANONYMITY && (!top || n > top.n)) top = { loc: l, time: t, n };
    }

  const byCategory = CATEGORIES.map((c) => ({ name: titleCase(c), count: reports.filter((r) => r.category === c).length })).filter((c) => c.count >= K_ANONYMITY);

  const accused: Record<string, { label: string; n: number; locs: Set<string> }> = {};
  for (const r of reports) {
    const k = r.accused_descriptor?.trim().toLowerCase();
    if (!k) continue;
    (accused[k] ??= { label: r.accused_descriptor.trim(), n: 0, locs: new Set() }).n++;
    if (r.location) accused[k].locs.add(r.location);
  }
  const repeat = Object.values(accused).filter((a) => a.n >= 2).sort((a, b) => b.n - a.n).slice(0, 8);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">Hotspots</h1>
        <p className="mt-1 text-sm text-navy/60">
          Where and when incidents cluster. Cells with fewer than {K_ANONYMITY} reports are hidden so no single reporter
          can be picked out.
        </p>
      </div>

      {top && (
        <Card className="border-amber/40 bg-amber-100/60">
          <p className="text-sm">
            <b>Strongest pattern:</b> {top.loc} at {top.time}, with {top.n} separate incidents. Consider a targeted
            measure there, such as night rounds or CCTV review.
          </p>
        </Card>
      )}

      <Card>
        <CardTitle>Location × time of day</CardTitle>
        <CardHint>Number of distinct incidents reported.</CardHint>
        {locations.length === 0 ? (
          <p className="py-12 text-center text-sm text-navy/50">Not enough data yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] border-separate border-spacing-1.5 text-sm">
              <thead>
                <tr>
                  <th />
                  {TIMES.map((t) => (
                    <th key={t} className="pb-1 text-xs font-semibold text-navy/60">
                      {titleCase(t)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {locations.map((l) => (
                  <tr key={l}>
                    <th className="whitespace-nowrap pr-3 text-left text-xs font-semibold text-navy/70">{l}</th>
                    {TIMES.map((t) => {
                      const n = grid[l][t] ?? 0;
                      return n >= K_ANONYMITY ? (
                        <td key={t} className="h-14 rounded-xl text-center text-base font-bold" style={cellStyle(n, max)} title={`${l}, ${t}: ${n} incidents`}>
                          {n}
                        </td>
                      ) : (
                        <td key={t} className="h-14 rounded-xl bg-navy/5 text-center text-[11px] text-navy/40" title="Fewer than 3 reports">
                          Not enough data
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-navy/50">
              Fewer
              {["#9CCFC6", "#3E9C90", "#126A60", "#142D3A"].map((c) => (
                <span key={c} className="h-3 w-6 rounded" style={{ backgroundColor: c }} />
              ))}
              More
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle>By category</CardTitle>
          <CardHint>Categories with at least {K_ANONYMITY} incidents.</CardHint>
          <div className="mt-3">
            <SimpleBar data={byCategory} dataKey="count" />
          </div>
        </Card>
        <Card>
          <CardTitle>Repeat accused</CardTitle>
          <CardHint>The same description appearing in more than one separate incident.</CardHint>
          {repeat.length === 0 ? (
            <p className="py-10 text-center text-sm text-navy/50">No repeated descriptions yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-navy/5">
              {repeat.map((a) => (
                <li key={a.label} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span>
                    <span className="font-medium">{a.label}</span>
                    <span className="block text-xs text-navy/50">{[...a.locs].join(", ")}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-danger-100 px-2.5 py-1 text-xs font-bold text-danger">{a.n} incidents</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
