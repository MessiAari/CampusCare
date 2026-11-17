"use client";
import { useState } from "react";
import Link from "next/link";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { browserDb } from "@/lib/supabase/browser";
import { titleCase } from "@/lib/utils";

export function LoginForm({
  notAdmin,
  demo,
}: {
  notAdmin: boolean;
  demo?: { password: string; accounts: { email: string; role: string }[] };
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(notAdmin ? "That account is not registered as an admin." : "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { error } = await browserDb().auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setBusy(false);
        return setError("Incorrect email or password.");
      }
      window.location.assign("/admin");
    } catch {
      setBusy(false);
      setError("Could not reach the sign-in service. Check the Supabase settings.");
    }
  }

  return (
    <div className="rise relative w-full max-w-sm rounded-3xl bg-white p-7 shadow-2xl">
      <div className="flex items-center gap-2 font-heading text-lg font-extrabold">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal text-white">
          <ShieldCheck className="h-5 w-5" />
        </span>
        CampusCare <span className="font-medium text-navy/50">Admin</span>
      </div>
      <p className="mt-2 text-sm text-navy/60">For committee members, the dean&apos;s office and the external authority.</p>
      <form onSubmit={submit} className="mt-5 space-y-3">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" variant="navy" className="w-full" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Sign in
        </Button>
      </form>
      {demo && (
        <div className="mt-4 rounded-xl bg-mint p-3">
          <p className="text-xs font-bold text-teal-600">Demo mode: tap a seeded account to fill</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {demo.accounts.map((a) => (
              <button
                key={a.email}
                type="button"
                className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold shadow-soft hover:bg-cloud"
                onClick={() => {
                  setEmail(a.email);
                  setPassword(demo.password);
                }}
              >
                {titleCase(a.role)}
              </button>
            ))}
          </div>
        </div>
      )}
      <Link href="/" className="mt-4 block text-center text-xs text-navy/50 underline">
        Back to the student site
      </Link>
    </div>
  );
}
