"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Download,
  FileUp,
  HeartHandshake,
  Loader2,
  Mic,
  Sparkles,
  Square,
  Trash2,
} from "lucide-react";
import { submitReport } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { LOCATIONS, TIMES } from "@/lib/constants";
import { cn, titleCase } from "@/lib/utils";

/** Re-encodes an image through a canvas, which drops EXIF (GPS, device, timestamps). */
async function stripExif(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    canvas.getContext("2d")!.drawImage(bmp, 0, 0);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.9));
    if (!blob) return file;
    return new File([blob], `image-${Date.now()}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

type Done = { code: string; passphrase: string; selfHarm: boolean; duplicate: boolean };

export function ReportWizard() {
  const [step, setStep] = useState(1);
  const [text, setText] = useState("");
  const [location, setLocation] = useState("");
  const [timeOfDay, setTimeOfDay] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [voice, setVoice] = useState<File | null>(null);
  const [recording, setRecording] = useState(false);
  const [voiceNote, setVoiceNote] = useState("");
  const [questions, setQuestions] = useState<string[] | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [busy, setBusy] = useState<"clarify" | "submit" | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Done | null>(null);
  const [copied, setCopied] = useState(false);

  const recRef = useRef<MediaRecorder | null>(null);
  const srRef = useRef<any>(null);
  const chunks = useRef<Blob[]>([]);

  useEffect(() => () => stopRecording(), []); // eslint-disable-line

  async function startRecording() {
    setVoiceNote("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size) setVoice(new File([blob], "voice-note.webm", { type: blob.type }));
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);

      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SR) {
        const sr = new SR();
        sr.lang = "en-IN";
        sr.continuous = true;
        sr.interimResults = false;
        sr.onresult = (ev: any) => {
          let add = "";
          for (let i = ev.resultIndex; i < ev.results.length; i++)
            if (ev.results[i].isFinal) add += ev.results[i][0].transcript;
          if (add.trim()) setText((t) => (t ? t.trimEnd() + " " : "") + add.trim());
        };
        sr.onerror = () => {};
        try {
          sr.start();
          srRef.current = sr;
        } catch {}
      } else {
        setVoiceNote("Live transcription isn't available in this browser. The recording will still be attached.");
      }
    } catch {
      setVoiceNote("Microphone access was blocked. You can type instead.");
    }
  }

  function stopRecording() {
    try {
      srRef.current?.stop();
    } catch {}
    srRef.current = null;
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
    recRef.current = null;
    setRecording(false);
  }

  async function addFiles(list: FileList | null) {
    if (!list) return;
    const cleaned = await Promise.all(Array.from(list).slice(0, 5).map(stripExif));
    setFiles((f) => [...f, ...cleaned].slice(0, 5));
  }

  async function runClarify() {
    setBusy("clarify");
    setError("");
    try {
      const res = await fetch("/api/ai/clarify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, location: location || undefined, time_of_day: timeOfDay || undefined }),
      });
      const json = res.ok ? await res.json() : { questions: [] };
      setQuestions(json.questions ?? []);
      setAnswers((json.questions ?? []).map(() => ""));
    } catch {
      setQuestions([]);
    }
    setBusy(null);
    setStep(3);
  }

  async function submit() {
    setBusy("submit");
    setError("");
    let full = text.trim();
    const qa = (questions ?? [])
      .map((q, i) => (answers[i]?.trim() ? `Q: ${q}\nA: ${answers[i].trim()}` : ""))
      .filter(Boolean);
    if (qa.length) full += "\n\n" + qa.join("\n");
    const form = new FormData();
    form.set("text", full);
    form.set("location", location);
    form.set("time_of_day", timeOfDay);
    files.forEach((f) => form.append("evidence", f));
    if (voice) form.append("evidence", voice);
    try {
      const res = await submitReport(form);
      if (!res.ok) setError(res.error);
      else setDone(res);
    } catch {
      setError("Something went wrong while sending your report. Please try again.");
    }
    setBusy(null);
  }

  // ---------- success ----------
  if (done) {
    const blob = `CampusCare case details\n\nCase code:  ${done.code}\nPassphrase: ${done.passphrase}\n\nKeep this private. You need both to return to your case from any device.\n`;
    return (
      <div className="space-y-4">
        <Card className="text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal text-white">
            <Check className="h-6 w-6" />
          </span>
          <h1 className="mt-3 text-2xl font-extrabold">Your report is in</h1>
          <p className="mt-1 text-sm text-navy/60">
            Save these now. For your safety the passphrase is shown <b>only once</b>.
          </p>
          <div className="mt-5 grid gap-3 text-left sm:grid-cols-2">
            <div className="rounded-2xl bg-mint p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">Case code</p>
              <p className="mt-1 font-heading text-2xl font-extrabold tabular-nums">{done.code}</p>
            </div>
            <div className="rounded-2xl bg-mint p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">Passphrase</p>
              <p className="mt-1 break-all font-mono text-base font-semibold">{done.passphrase}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(`${done.code}\n${done.passphrase}`);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy both"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const a = document.createElement("a");
                a.href = URL.createObjectURL(new Blob([blob], { type: "text/plain" }));
                a.download = `campuscare-${done.code}.txt`;
                a.click();
                URL.revokeObjectURL(a.href);
              }}
            >
              <Download className="h-4 w-4" /> Download
            </Button>
            <Link
              href={`/case/${done.code}`}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-teal px-5 text-sm font-semibold text-white hover:bg-teal-600"
            >
              Track my case <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Card>
        {done.duplicate && (
          <Card className="bg-mint/60 text-sm">
            <b>You&apos;re not alone.</b> Someone else has reported what looks like the same incident. Your report has
            been added to theirs as a +1, which raises its priority.
          </Card>
        )}
        {done.selfHarm && (
          <Card className="border-danger/30 bg-danger-100 text-sm">
            <div className="flex items-start gap-3">
              <HeartHandshake className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
              <p>
                What you shared sounds really heavy. A counselor has been alerted to this case, without your identity.
                If you need to talk to someone right now, <b>Tele-MANAS 14416</b> is free and open 24×7.
              </p>
            </div>
          </Card>
        )}
      </div>
    );
  }

  // ---------- wizard ----------
  const stepNames = ["What happened", "Details", "Review"];
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">File a report</h1>
        <p className="mt-1 text-sm text-navy/60">Take your time. Nothing is sent until the last step.</p>
      </div>

      <ol className="flex items-center gap-2">
        {stepNames.map((n, i) => (
          <li key={n} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                step > i + 1 ? "bg-teal text-white" : step === i + 1 ? "bg-navy text-white" : "bg-navy/10 text-navy/50"
              )}
            >
              {step > i + 1 ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={cn("hidden text-xs font-semibold sm:block", step === i + 1 ? "text-navy" : "text-navy/50")}>{n}</span>
            {i < 2 && <span className="h-px flex-1 bg-navy/10" />}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <Card className="space-y-4">
          <div>
            <CardTitle>What happened?</CardTitle>
            <CardHint>Write it in your own words, in any order. It will be rewritten neutrally before the committee reads it.</CardHint>
          </div>
          <Textarea
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="For example: Last night in the hostel common room, a group of seniors made the first-years…"
            aria-label="Describe what happened"
          />
          <div className="rounded-2xl bg-cloud p-4">
            <div className="flex flex-wrap items-center gap-3">
              {recording ? (
                <Button type="button" variant="danger" onClick={stopRecording}>
                  <Square className="h-4 w-4" /> Stop recording
                </Button>
              ) : (
                <Button type="button" variant="outline" onClick={startRecording}>
                  <Mic className="h-4 w-4" /> {voice ? "Record again" : "Add a voice note"}
                </Button>
              )}
              {recording && (
                <span className="inline-flex items-center gap-2 text-sm font-medium text-danger">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-danger" /> Listening…
                </span>
              )}
              {voice && !recording && (
                <span className="inline-flex items-center gap-2 text-sm text-teal-600">
                  <Check className="h-4 w-4" /> Voice note attached
                  <button type="button" onClick={() => setVoice(null)} aria-label="Remove voice note">
                    <Trash2 className="h-4 w-4 text-navy/40 hover:text-danger" />
                  </button>
                </span>
              )}
            </div>
            <p className="mt-2 text-xs text-navy/50">
              {voiceNote || "Optional. What you say is typed into the box above where the browser supports it."}
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setStep(2)} disabled={text.trim().length < 10 || recording}>
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="space-y-5">
          <div>
            <Label>Where did it happen?</Label>
            <div className="flex flex-wrap gap-2">
              {LOCATIONS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLocation(location === l ? "" : l)}
                  className={cn(
                    "rounded-full border px-3.5 py-2 text-sm font-medium",
                    location === l ? "border-teal bg-teal text-white" : "border-navy/15 bg-white hover:bg-mint"
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Around what time of day?</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {TIMES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTimeOfDay(timeOfDay === t ? "" : t)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-sm font-medium",
                    timeOfDay === t ? "border-teal bg-teal text-white" : "border-navy/15 bg-white hover:bg-mint"
                  )}
                >
                  {titleCase(t)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="ev">Evidence (optional)</Label>
            <label
              htmlFor="ev"
              className="flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-navy/15 bg-cloud px-4 py-6 text-center hover:border-teal"
            >
              <FileUp className="h-5 w-5 text-teal" />
              <span className="text-sm font-medium">Add photos, screenshots or documents</span>
              <span className="text-xs text-navy/50">Location and device data are removed from photos before upload. Up to 5 files.</span>
            </label>
            <input id="ev" type="file" multiple className="sr-only" accept="image/*,audio/*,video/*,.pdf" onChange={(e) => addFiles(e.target.files)} />
            {files.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between rounded-xl bg-mint px-3 py-2 text-sm">
                    <span className="truncate">{f.name}</span>
                    <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`}>
                      <Trash2 className="h-4 w-4 text-navy/40 hover:text-danger" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button onClick={runClarify} disabled={busy !== null}>
              {busy === "clarify" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {busy === "clarify" ? "Checking…" : "Review"}
            </Button>
          </div>
        </Card>
      )}

      {step === 3 && (
        <div className="space-y-4">
          {questions && questions.length > 0 && (
            <Card className="space-y-4 border-teal/20 bg-mint/60">
              <div className="flex items-start gap-2">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-teal" />
                <div>
                  <CardTitle>A couple of details would help</CardTitle>
                  <CardHint>These make it easier for the committee to act. Skip any you&apos;d rather not answer.</CardHint>
                </div>
              </div>
              {questions.map((q, i) => (
                <div key={i}>
                  <Label htmlFor={`q${i}`}>{q}</Label>
                  <Input
                    id={`q${i}`}
                    value={answers[i] ?? ""}
                    onChange={(e) => setAnswers(answers.map((a, j) => (j === i ? e.target.value : a)))}
                    placeholder="Optional"
                  />
                </div>
              ))}
            </Card>
          )}
          <Card className="space-y-3">
            <CardTitle>Review</CardTitle>
            <p className="whitespace-pre-wrap rounded-xl bg-cloud p-3.5 text-sm leading-relaxed">{text}</p>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-navy/50">Location</dt>
                <dd className="font-medium">{location || "Not given"}</dd>
              </div>
              <div>
                <dt className="text-xs text-navy/50">Time of day</dt>
                <dd className="font-medium">{timeOfDay ? titleCase(timeOfDay) : "Not given"}</dd>
              </div>
              <div>
                <dt className="text-xs text-navy/50">Attachments</dt>
                <dd className="font-medium">{files.length + (voice ? 1 : 0)}</dd>
              </div>
            </dl>
            {error && <p className="rounded-xl bg-danger-100 p-3 text-sm text-danger">{error}</p>}
            <div className="flex justify-between pt-1">
              <Button variant="ghost" onClick={() => setStep(2)} disabled={busy !== null}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={submit} disabled={busy !== null}>
                {busy === "submit" && <Loader2 className="h-4 w-4 animate-spin" />}
                {busy === "submit" ? "Sending securely…" : "Submit anonymously"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
