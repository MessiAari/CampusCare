"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, KeyRound, Loader2 } from "lucide-react";
import { caseLogin, erpLogin } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";

export function AuthPanels({
  loggedIn,
  demoHint,
}: {
  loggedIn: boolean;
  demoHint?: { roll: string; password: string };
}) {
  const router = useRouter();
  const [roll, setRoll] = useState("");
  const [pw, setPw] = useState("");
  const [code, setCode] = useState("");
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState<"erp" | "case" | null>(null);
  const [err, setErr] = useState<{ erp?: string; case?: string }>({});

  async function doErp(e: React.FormEvent) {
    e.preventDefault();
    setBusy("erp");
    setErr({});
    const res = await erpLogin(roll, pw);
    if (!res.ok) {
      setBusy(null);
      return setErr({ erp: res.error });
    }
    router.push("/report");
  }

  async function doCase(e: React.FormEvent) {
    e.preventDefault();
    setBusy("case");
    setErr({});
    const res = await caseLogin(code, phrase);
    if (!res.ok) {
      setBusy(null);
      return setErr({ case: res.error });
    }
    router.push(`/case/${res.code}`);
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {!loggedIn && (
        <Card>
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-teal" />
            <CardTitle>Login with ERP</CardTitle>
          </div>
          <CardHint className="mt-1">To file a new report. Used once to verify you, never stored with it.</CardHint>
          <form onSubmit={doErp} className="mt-4 space-y-3">
            <div>
              <Label htmlFor="roll">Roll number</Label>
              <Input id="roll" value={roll} onChange={(e) => setRoll(e.target.value)} autoComplete="off" placeholder="e.g. 21CS101" />
            </div>
            <div>
              <Label htmlFor="pw">ERP password</Label>
              <Input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="off" />
            </div>
            {err.erp && <p className="text-sm text-danger">{err.erp}</p>}
            <Button type="submit" className="w-full" disabled={busy !== null}>
              {busy === "erp" && <Loader2 className="h-4 w-4 animate-spin" />} Verify and continue
            </Button>
            {demoHint && (
              <button
                type="button"
                className="w-full rounded-xl bg-mint px-3 py-2 text-left text-xs text-teal-600"
                onClick={() => {
                  setRoll(demoHint.roll);
                  setPw(demoHint.password);
                }}
              >
                <b>Demo mode:</b> tap to fill a seeded student ({demoHint.roll}).
              </button>
            )}
          </form>
        </Card>
      )}

      <Card className={loggedIn ? "sm:col-span-2" : ""}>
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-teal" />
          <CardTitle>Return to my case</CardTitle>
        </div>
        <CardHint className="mt-1">Works from any device. No login needed.</CardHint>
        <form onSubmit={doCase} className="mt-4 space-y-3">
          <div>
            <Label htmlFor="code">Case code</Label>
            <Input id="code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoComplete="off" placeholder="CC-7K3P" />
          </div>
          <div>
            <Label htmlFor="phrase">Passphrase</Label>
            <Input id="phrase" value={phrase} onChange={(e) => setPhrase(e.target.value)} autoComplete="off" placeholder="river-maple-quiet-amber-42" />
          </div>
          {err.case && <p className="text-sm text-danger">{err.case}</p>}
          <Button type="submit" variant="navy" className="w-full" disabled={busy !== null}>
            {busy === "case" && <Loader2 className="h-4 w-4 animate-spin" />} Open my case
          </Button>
        </form>
      </Card>
    </div>
  );
}
