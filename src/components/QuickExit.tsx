"use client";
import { LogOut } from "lucide-react";

/** Leaves the site instantly and replaces the history entry so Back does not return here. */
export function QuickExit() {
  return (
    <button
      type="button"
      onClick={() => window.location.replace("https://www.google.com")}
      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-danger px-3.5 text-xs font-bold text-white shadow-soft hover:bg-danger/90"
      title="Leave this site immediately"
    >
      <LogOut className="h-3.5 w-3.5" />
      Quick exit
    </button>
  );
}
