export const LOCATIONS = [
  "Hostel A",
  "Hostel B",
  "Hostel C",
  "Canteen",
  "Library",
  "Bus Stop",
  "Academic Block",
  "Sports Ground",
  "Online",
  "Other",
] as const;

export const TIMES = ["morning", "afternoon", "evening", "night"] as const;

export const CATEGORIES = [
  "ragging",
  "sexual harassment",
  "bullying",
  "discrimination",
  "grievance",
  "other",
] as const;

export const URGENCIES = ["critical", "high", "normal"] as const;
export type Urgency = (typeof URGENCIES)[number];

export const DEADLINE_HOURS: Record<Urgency, number> = { critical: 24, high: 72, normal: 168 };

export const LEVEL_NAMES = ["Committee", "Dean", "External authority"] as const;
export const ROLE_LEVEL: Record<string, number> = { committee: 0, dean: 1, external: 2 };

export const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  pending_confirmation: "Awaiting your confirmation",
  closed: "Closed",
  reopened: "Reopened",
  dismissed: "Dismissed",
};

export const ACTIVE_STATUSES = ["open", "in_progress", "reopened"];

export const SPAM_THRESHOLD = 0.7;
export const MAX_REPORTS_PER_MONTH = 3;
export const K_ANONYMITY = 3;

export const EVENT_LABEL: Record<string, string> = {
  report_submitted: "Report submitted",
  evidence_added: "Evidence added",
  counselor_alerted: "Counselor alerted",
  duplicate_linked: "Linked to a similar report",
  plus_one: "Another student reported the same incident",
  status_changed: "Status updated",
  proof_added: "Proof of action recorded",
  closure_requested: "Closure requested",
  closure_accepted: "Closure accepted by reporter",
  closure_rejected: "Closure rejected by reporter",
  escalated: "Escalated",
  original_viewed: "Original text viewed by an admin",
  followup_answered: "Follow-up answered",
  reopened: "Case reopened",
  dismissed: "Case dismissed",
};
