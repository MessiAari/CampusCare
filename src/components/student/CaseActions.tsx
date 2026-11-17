"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, HelpCircle, Loader2, XCircle } from "lucide-react";
import { answerFollowup, respondClosure } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { fmtDate } from "@/lib/utils";

/** The two moments where the reporter decides: accept/reject a closure, and "has it stopped?". */
export function CaseActions({
  code,
  status,
  proof,
  followupId,
}: {
  code: string;
  status: string;
  proof: { description: string; created_at: string } | null;
  followupId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) {
    setBusy(true);
    setError("");
    const res = await fn();
    setBusy(false);
    if (!res.ok) return setError(res.error ?? "Something went wrong.");
    setNote(msg);
    router.refresh();
  }

  return (
    <>
      {note && <Card className="bg-mint/70 text-sm font-medium text-teal-600">{note}</Card>}

      {status === "pending_confirmation" && (
        <Card className="border-amber/40 bg-amber-100/60">
          <CardTitle>The committee wants to close this case</CardTitle>
          <CardHint className="mt-1">It only closes if you agree. Here is what they say was done:</CardHint>
          <blockquote className="mt-3 rounded-xl bg-white p-3.5 text-sm leading-relaxed">
            {proof?.description ?? "No description was provided."}
            {proof && <span className="mt-1 block text-xs text-navy/50">Recorded {fmtDate(proof.created_at)}</span>}
          </blockquote>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button
              disabled={busy}
              onClick={() => run(() => respondClosure(code, true), "Thank you. The case is closed. We'll quietly check in with you later.")}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Accept, it&apos;s resolved
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => run(() => respondClosure(code, false), "Understood. The case has been reopened and moved to a higher authority.")}
            >
              <XCircle className="h-4 w-4" /> Reject, not resolved
            </Button>
          </div>
          <p className="mt-2 text-xs text-navy/60">Rejecting reopens the case and sends it one level up.</p>
        </Card>
      )}

      {status === "closed" && followupId && (
        <Card className="border-teal/30 bg-mint/70">
          <div className="flex items-start gap-2">
            <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-teal" />
            <div>
              <CardTitle>A quiet check-in: has it stopped?</CardTitle>
              <CardHint>Only you can see this. If it hasn&apos;t stopped, the case reopens at a higher level.</CardHint>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button disabled={busy} onClick={() => run(() => answerFollowup(code, followupId, true), "Glad to hear it. Thank you for letting us know.")}>
              Yes, it has stopped
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => run(() => answerFollowup(code, followupId, false), "Thank you for telling us. The case has been reopened and escalated.")}
            >
              No, it&apos;s still happening
            </Button>
          </div>
        </Card>
      )}

      {error && <Card className="bg-danger-100 text-sm text-danger">{error}</Card>}
    </>
  );
}
