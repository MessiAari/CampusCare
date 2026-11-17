"use client";
import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/** Live countdown to a deadline. serverNow carries the (possibly fast-forwarded) server clock. */
export function Countdown({
  deadline,
  serverNow,
  className,
  compact,
}: {
  deadline: string;
  serverNow: string;
  className?: string;
  compact?: boolean;
}) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const skew = new Date(serverNow).getTime() - Date.now();
    const tick = () => setLeft(new Date(deadline).getTime() - (Date.now() + skew));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [deadline, serverNow]);

  if (left === null) return <span className={cn("tabular-nums text-navy/40", className)}>…</span>;
  const overdue = left <= 0;
  const s = Math.floor(Math.abs(left) / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  const text = overdue ? "Overdue" : `${d > 0 ? d + "d " : ""}${pad(h)}:${pad(m)}:${pad(s % 60)}`;
  const tone = overdue || left < 6 * 3600_000 ? "text-danger" : left < 24 * 3600_000 ? "text-[#9A6A16]" : "text-teal";
  return (
    <span className={cn("inline-flex items-center gap-1 font-semibold tabular-nums", tone, className)}>
      {!compact && <Clock className="h-3.5 w-3.5" />}
      {text}
    </span>
  );
}
