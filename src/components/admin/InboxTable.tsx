"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { AlarmClock, ArrowUpRight, Flame, HeartPulse, Hourglass, Inbox, Users } from "lucide-react";
import { Countdown } from "@/components/Countdown";
import { Badge, StatusBadge, UrgencyBadge } from "@/components/ui/badge";
import { ACTIVE_STATUSES, LEVEL_NAMES, SPAM_THRESHOLD } from "@/lib/constants";
import { cn, fmtDate, titleCase } from "@/lib/utils";

const FILTERS = [
  { key: "active", label: "Active" },
  { key: "pending_confirmation", label: "Awaiting reporter" },
  { key: "closed", label: "Closed" },
  { key: "dismissed", label: "Dismissed" },
  { key: "all", label: "All" },
];
const URG_ORDER: Record<string, number> = { critical: 0, high: 1, normal: 2 };

export function InboxTable({ reports, serverNow, adminLevel }: { reports: any[]; serverNow: string; adminLevel: number }) {
  const [tab, setTab] = useState<"cases" | "spam">("cases");
  const [filter, setFilter] = useState("active");
  const [mine, setMine] = useState(false);

  const spam = useMemo(() => reports.filter((r) => Number(r.spam_score) >= SPAM_THRESHOLD), [reports]);
  const real = useMemo(() => reports.filter((r) => Number(r.spam_score) < SPAM_THRESHOLD), [reports]);

  const rows = useMemo(() => {
    let list = tab === "spam" ? spam : real;
    if (tab === "cases") {
      if (filter === "active") list = list.filter((r) => ACTIVE_STATUSES.includes(r.status));
      else if (filter !== "all") list = list.filter((r) => r.status === filter);
      if (mine) list = list.filter((r) => r.escalation_level === adminLevel);
    }
    return [...list].sort(
      (a, b) =>
        Number(ACTIVE_STATUSES.includes(b.status)) - Number(ACTIVE_STATUSES.includes(a.status)) ||
        URG_ORDER[a.urgency] - URG_ORDER[b.urgency] ||
        +new Date(a.deadline_at) - +new Date(b.deadline_at)
    );
  }, [tab, filter, mine, spam, real, adminLevel]);

  const activeReal = real.filter((r) => ACTIVE_STATUSES.includes(r.status));
  const soon = +new Date(serverNow) + 24 * 3600_000;
  const tiles = [
    { label: "Active cases", value: activeReal.length, icon: Flame, tint: "from-[#2FA896] to-teal" },
    { label: "Critical", value: activeReal.filter((r) => r.urgency === "critical").length, icon: HeartPulse, tint: "from-[#DD6C74] to-danger" },
    { label: "Due within 24h", value: activeReal.filter((r) => +new Date(r.deadline_at) < soon).length, icon: AlarmClock, tint: "from-[#E6B15A] to-amber" },
    { label: "Escalated", value: activeReal.filter((r) => r.escalation_level > 0).length, icon: ArrowUpRight, tint: "from-navy-600 to-navy" },
    { label: "Awaiting reporter", value: real.filter((r) => r.status === "pending_confirmation").length, icon: Hourglass, tint: "from-navy-600 to-navy" },
  ];

  return (
    <div className="mt-5">
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        {tiles.map((x) => (
          <div key={x.label} className="relative overflow-hidden rounded-3xl bg-white p-4 shadow-soft ring-1 ring-navy/5 transition-transform hover:-translate-y-0.5">
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${x.tint} text-white shadow-md`}>
              <x.icon className="h-4 w-4" />
            </span>
            <p className="mt-3 font-heading text-3xl font-extrabold tabular-nums leading-none">{x.value}</p>
            <p className="mt-1 text-xs font-medium text-navy/60">{x.label}</p>
            <span className={`absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br ${x.tint} opacity-10`} />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-navy/10">
        {(["cases", "spam"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "-mb-px border-b-2 px-3 pb-2.5 text-sm font-semibold",
              tab === t ? "border-teal text-navy" : "border-transparent text-navy/50 hover:text-navy"
            )}
          >
            {t === "cases" ? `Cases (${real.length})` : `Spam-likely (${spam.length})`}
          </button>
        ))}
      </div>

      {tab === "cases" && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold",
                filter === f.key ? "bg-navy text-white" : "bg-white text-navy/70 shadow-soft hover:bg-mint"
              )}
            >
              {f.label}
            </button>
          ))}
          <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs font-medium text-navy/70">
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="h-4 w-4 accent-teal" />
            Only cases at my level ({LEVEL_NAMES[adminLevel]})
          </label>
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-3xl bg-white shadow-soft ring-1 ring-navy/5">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Inbox className="h-9 w-9 text-navy/20" />
            <p className="mt-3 text-sm font-semibold">Nothing here</p>
            <p className="text-sm text-navy/50">
              {tab === "spam" ? "No reports look like spam." : "No cases match this filter."}
            </p>
          </div>
        ) : (
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-navy/5 text-xs uppercase tracking-wide text-navy/50">
              <tr>
                <th className="px-4 py-3 font-semibold">Case</th>
                <th className="px-4 py-3 font-semibold">Urgency</th>
                <th className="px-4 py-3 font-semibold">Summary</th>
                <th className="px-4 py-3 font-semibold">Level</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Deadline</th>
                <th className="px-4 py-3 text-right font-semibold">Spam</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/5">
              {rows.map((r) => (
                <tr key={r.id} className="group hover:bg-mint/40">
                  <td className="px-4 py-3 align-top">
                    <Link href={`/admin/case/${r.id}`} className="whitespace-nowrap font-bold tabular-nums text-navy group-hover:text-teal">
                      {r.case_code}
                    </Link>
                    <p className="whitespace-nowrap text-xs text-navy/50">{fmtDate(r.created_at)}</p>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-col items-start gap-1">
                      <UrgencyBadge urgency={r.urgency} />
                      {r.self_harm_flag && (
                        <Badge tone="red" title="Counselor alerted">
                          <HeartPulse className="h-3 w-3" /> Counselor
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="max-w-sm px-4 py-3 align-top">
                    <Link href={`/admin/case/${r.id}`} className="line-clamp-2 text-navy/80">
                      {r.scrubbed_summary}
                    </Link>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-navy/50">
                      <span>{titleCase(r.category)}</span>·<span>{r.location ?? "Unknown"}</span>
                      {r.plus_one_count > 0 && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-teal-100 px-1.5 py-0.5 font-bold text-teal-600">
                          <Users className="h-3 w-3" />+{r.plus_one_count}
                        </span>
                      )}
                      {r.reopen_count > 0 && <span className="font-semibold text-danger">Reopened ×{r.reopen_count}</span>}
                    </p>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <Badge tone={r.escalation_level === 0 ? "teal" : r.escalation_level === 1 ? "amber" : "red"}>
                      {LEVEL_NAMES[r.escalation_level]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 align-top">
                    {ACTIVE_STATUSES.includes(r.status) ? (
                      <Countdown deadline={r.deadline_at} serverNow={serverNow} />
                    ) : (
                      <span className="text-navy/30">–</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right align-top tabular-nums text-navy/60">
                    {Math.round(Number(r.spam_score) * 100)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
