"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Eye, Loader2, Lock } from "lucide-react";
import { addProof, requestClosure, setStatus, viewOriginal } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { ACTIVE_STATUSES } from "@/lib/constants";

export function ViewOriginal({ reportId, canAct }: { reportId: string; canAct: boolean }) {
  const router = useRouter();
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);

  async function open() {
    setBusy(true);
    setError("");
    const res = await viewOriginal(reportId);
    setBusy(false);
    setConfirm(false);
    if (!res.ok) return setError(res.error);
    setText(res.text);
    router.refresh();
  }

  return (
    <div className="mt-4 border-t border-navy/5 pt-4">
      {text !== null ? (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-navy/50">Original text (this view was logged)</p>
          <p className="whitespace-pre-wrap rounded-xl border border-navy/10 bg-white p-3.5 text-sm leading-relaxed">{text}</p>
        </div>
      ) : confirm ? (
        <div className="rounded-xl bg-amber-100 p-3.5 text-sm text-[#7A5311]">
          <p>
            Opening the reporter&apos;s original words is recorded in the audit log, and the reporter will see that it
            was opened. Continue?
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="amber" onClick={open} disabled={busy}>
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Yes, view and log
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs text-navy/50">
            <Lock className="h-3.5 w-3.5" /> The original text is encrypted. You see the scrubbed summary by default.
          </span>
          <Button size="sm" variant="outline" onClick={() => setConfirm(true)} disabled={!canAct}>
            <Eye className="h-3.5 w-3.5" /> View original
          </Button>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}

export function ProofForm({ reportId }: { reportId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    form.set("reportId", reportId);
    const res = await addProof(form);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    formRef.current?.reset();
    router.refresh();
  }

  return (
    <form ref={formRef} onSubmit={submit} className="mt-4 space-y-2.5">
      <Textarea
        name="description"
        rows={3}
        required
        placeholder="What exactly was done, by whom and when? e.g. 'Committee met on 14 Nov; written warning ref. DC/2026/112 issued to the three students; hostel warden assigned night rounds.'"
        aria-label="Proof of action"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input name="file" type="file" className="text-xs text-navy/60 file:mr-2 file:rounded-lg file:border-0 file:bg-mint file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-teal-600" />
        <Button type="submit" size="sm" disabled={busy}>
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {busy ? "Checking with AI…" : "Add proof"}
        </Button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </form>
  );
}

export function CaseActionBar({
  reportId,
  status,
  canAct,
  hasProof,
  latestFlagged,
}: {
  reportId: string;
  status: string;
  canAct: boolean;
  hasProof: boolean;
  latestFlagged: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const active = ACTIVE_STATUSES.includes(status);

  async function run(key: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(key);
    setError("");
    const res = await fn();
    setBusy("");
    if (!res.ok) setError(res.error ?? "Failed");
    router.refresh();
  }

  if (status === "pending_confirmation")
    return (
      <p className="mt-4 rounded-xl bg-amber-100 p-3 text-sm text-[#7A5311]">
        Closure requested. Waiting for the reporter to accept or reject it.
      </p>
    );
  if (!active) return null;

  return (
    <div className="mt-4 border-t border-navy/5 pt-4">
      {latestFlagged && (
        <p className="mb-3 flex items-start gap-2 text-xs text-[#7A5311]">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          The latest proof was flagged as vague. The reporter will see it and is more likely to reject the closure.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={!canAct || !hasProof || !!busy}
          onClick={() => run("close", () => requestClosure(reportId))}
          title={hasProof ? "" : "Add proof of action first"}
        >
          {busy === "close" && <Loader2 className="h-4 w-4 animate-spin" />} Request closure
        </Button>
        {status !== "in_progress" && (
          <Button variant="outline" disabled={!canAct || !!busy} onClick={() => run("prog", () => setStatus(reportId, "in_progress"))}>
            Mark in progress
          </Button>
        )}
        <Button
          variant="ghost"
          className="text-danger"
          disabled={!canAct || !!busy}
          onClick={() => {
            if (window.confirm("Dismiss this case? The reporter will see that it was dismissed.")) run("dis", () => setStatus(reportId, "dismissed"));
          }}
        >
          Dismiss
        </Button>
        {!hasProof && <span className="text-xs text-navy/50">Add proof of action to enable closure.</span>}
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
