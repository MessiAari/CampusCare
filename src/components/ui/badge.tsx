import * as React from "react";
import { cn } from "@/lib/utils";

const tones = {
  red: "bg-danger-100 text-danger",
  amber: "bg-amber-100 text-[#9A6A16]",
  teal: "bg-teal-100 text-teal-600",
  navy: "bg-navy/10 text-navy",
  mint: "bg-mint text-teal-600",
} as const;

export function Badge({
  tone = "navy",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}

export function UrgencyBadge({ urgency }: { urgency: string }) {
  const tone = urgency === "critical" ? "red" : urgency === "high" ? "amber" : "teal";
  return <Badge tone={tone}>{urgency[0].toUpperCase() + urgency.slice(1)}</Badge>;
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [keyof typeof tones, string]> = {
    open: ["navy", "Open"],
    in_progress: ["amber", "In progress"],
    pending_confirmation: ["amber", "Awaiting reporter"],
    closed: ["teal", "Closed"],
    reopened: ["red", "Reopened"],
    dismissed: ["navy", "Dismissed"],
  };
  const [tone, label] = map[status] ?? ["navy", status];
  return <Badge tone={tone}>{label}</Badge>;
}
