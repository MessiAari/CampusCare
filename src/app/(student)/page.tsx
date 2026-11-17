import Link from "next/link";
import { ArrowRight, BadgeCheck, EyeOff, Fingerprint, KeyRound, Lock, Timer } from "lucide-react";
import { AuthPanels } from "@/components/student/AuthPanels";
import { HeroArt } from "@/components/student/HeroArt";
import { StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DEMO_PASSWORD, DEMO_STUDENTS, isDemo } from "@/lib/demo";
import { getSession } from "@/lib/session";
import { serviceDb } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    icon: Fingerprint,
    tint: "from-[#2FA896] to-teal",
    title: "We check you're a student, then forget who",
    body: "Your ERP login only proves you belong to this college. It is turned into a one-way code on the server. Your roll number is never saved with a report.",
  },
  {
    icon: EyeOff,
    tint: "from-navy-600 to-navy",
    title: "Your words are rewritten before anyone reads them",
    body: "The committee sees a neutral summary with names of bystanders and identifying details removed. Your original text is encrypted, and opening it is logged where you can see it.",
  },
  {
    icon: KeyRound,
    tint: "from-[#E6B15A] to-amber",
    title: "Only you hold the key to your case",
    body: "You get a case code and a passphrase, shown once. Use them from any device to track progress, chat, and accept or reject the outcome.",
  },
];

const PROMISES = [
  { icon: Timer, big: "24h", small: "deadline for critical cases" },
  { icon: BadgeCheck, big: "You decide", small: "when a case is closed" },
  { icon: Lock, big: "0", small: "names stored with a report" },
];

export default async function Landing() {
  let session = null;
  let myCases: any[] = [];
  let setupError = "";
  try {
    session = await getSession();
    if (session?.anon_id) {
      const { data } = await serviceDb()
        .from("reports")
        .select("case_code, status, created_at")
        .eq("anon_id", session.anon_id)
        .order("created_at", { ascending: false })
        .limit(5);
      myCases = data ?? [];
    }
  } catch (e: any) {
    setupError = e?.message ?? "Setup incomplete";
  }

  return (
    <div className="space-y-14">
      <section className="grid items-center gap-8 pt-2 lg:grid-cols-[1.1fr_0.9fr] lg:pt-8">
        <div className="rise text-center lg:text-left">
          <span className="glass inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-teal-600 shadow-soft">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-teal" />
            </span>
            Verified, but anonymous
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl">
            Speak up safely.
            <br />
            <span className="text-gradient">Be heard.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-navy/70 sm:text-lg lg:mx-0">
            Report ragging, harassment or a grievance without your name attached. Every case has a deadline, and it
            isn&apos;t closed until you say it&apos;s resolved.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3 lg:justify-start">
            <a
              href={session?.anon_id ? "/report" : "#start"}
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-gradient-to-b from-[#1F9A8B] to-teal px-6 text-base font-semibold text-white shadow-[0_12px_24px_-10px_rgba(22,124,112,0.85)] transition-all hover:-translate-y-0.5"
            >
              File a report <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#start"
              className="glass inline-flex h-12 items-center gap-2 rounded-2xl px-6 text-base font-semibold shadow-soft transition-all hover:-translate-y-0.5"
            >
              <KeyRound className="h-4 w-4 text-teal" /> Return to my case
            </a>
          </div>
          <dl className="mt-9 grid grid-cols-3 gap-3">
            {PROMISES.map((p) => (
              <div key={p.small} className="glass rounded-2xl p-3 text-left shadow-soft">
                <p.icon className="h-4 w-4 text-teal" />
                <dt className="mt-1.5 font-heading text-lg font-extrabold leading-none sm:text-xl">{p.big}</dt>
                <dd className="mt-1 text-[11px] leading-tight text-navy/60">{p.small}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="hidden sm:block">
          <HeroArt />
        </div>
      </section>

      {setupError && (
        <Card className="border-amber/40 bg-amber-100 text-sm">
          <b>Setup needed:</b> {setupError}
        </Card>
      )}

      <section id="start" className="mx-auto max-w-3xl scroll-mt-24 space-y-4">
        {session?.anon_id ? (
          <div className="panel-dark relative overflow-hidden rounded-3xl p-6 text-white shadow-soft">
            <div className="dots-light absolute inset-0" />
            <div className="relative flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-[#8FE3D6]">
                  <BadgeCheck className="h-4 w-4" /> Verified
                </p>
                <h2 className="mt-1 text-xl font-bold">You&apos;re in, and still anonymous</h2>
                <p className="text-sm text-white/70">This session holds only a one-way anonymous id.</p>
              </div>
              <Link
                href="/report"
                className="inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-6 text-sm font-bold text-navy shadow-lg transition-all hover:-translate-y-0.5"
              >
                File a report <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            {myCases.length > 0 && (
              <div className="relative mt-5 space-y-2 border-t border-white/10 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Your cases</p>
                {myCases.map((c) => (
                  <Link
                    key={c.case_code}
                    href={`/case/${c.case_code}`}
                    className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-2.5 text-sm transition-colors hover:bg-white/20"
                  >
                    <span className="font-semibold tabular-nums">{c.case_code}</span>
                    <StatusBadge status={c.status} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : null}

        <AuthPanels
          loggedIn={!!session?.anon_id}
          demoHint={isDemo() ? { roll: DEMO_STUDENTS[0].roll_no, password: DEMO_PASSWORD } : undefined}
        />
      </section>

      <section>
        <p className="text-center text-xs font-bold uppercase tracking-widest text-teal">How it works</p>
        <h2 className="mt-2 text-center text-2xl font-extrabold sm:text-3xl">How your anonymity is protected</h2>
        <div className="relative mt-10 grid gap-10 sm:grid-cols-3 sm:gap-5">
          <div className="absolute left-[16%] right-[16%] top-7 hidden border-t-2 border-dashed border-teal/30 sm:block" />
          {STEPS.map((s, i) => (
            <div key={s.title} className="relative text-center">
              <span
                className={`relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${s.tint} text-white shadow-[0_14px_24px_-12px_rgba(20,45,58,0.6)] ring-8 ring-cloud`}
              >
                <s.icon className="h-6 w-6" />
                <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-extrabold text-navy shadow-soft">
                  {i + 1}
                </span>
              </span>
              <div className="glass mt-5 rounded-3xl p-5 text-left shadow-soft transition-transform hover:-translate-y-1">
                <h3 className="text-sm font-bold leading-snug">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-navy/70">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <p className="text-center text-xs text-navy/50">
        Committee member?{" "}
        <Link href="/admin" className="font-semibold text-navy/70 underline">
          Admin sign in
        </Link>
      </p>
    </div>
  );
}
