import { Clock, EyeOff, MessageCircle, ShieldCheck } from "lucide-react";

/** Decorative preview of a case, shown beside the hero text. Not interactive. */
export function HeroArt() {
  return (
    <div className="relative mx-auto h-[430px] w-full max-w-md" aria-hidden="true">
      <div className="absolute inset-6 rounded-[2.5rem] bg-gradient-to-br from-teal/30 via-mint to-amber/30 blur-2xl" />
      <div className="dots absolute -right-2 top-2 h-28 w-28 rounded-3xl" />

      {/* phone */}
      <div className="absolute inset-x-0 top-4 flex justify-center">
      <div className="float">
      <div className="w-64 rotate-[-4deg] rounded-[2rem] bg-navy p-2.5 shadow-[0_30px_60px_-20px_rgba(20,45,58,0.55)]">
        <div className="overflow-hidden rounded-[1.5rem] bg-cloud">
          <div className="panel-dark px-4 pb-5 pt-4 text-white">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/60">Your case</p>
            <p className="font-heading text-2xl font-extrabold tabular-nums">CC-7K3P</p>
            <div className="mt-3 flex gap-1.5">
              <span className="h-1.5 flex-1 rounded-full bg-[#5FD3C2]" />
              <span className="h-1.5 flex-1 rounded-full bg-white/20" />
              <span className="h-1.5 flex-1 rounded-full bg-white/20" />
            </div>
            <p className="mt-1.5 text-[10px] text-white/70">With the committee</p>
          </div>
          <div className="space-y-2.5 p-3.5">
            <div className="rounded-2xl bg-white p-3 shadow-soft">
              <p className="text-[10px] font-semibold text-navy/50">They must respond within</p>
              <p className="flex items-center gap-1.5 font-heading text-xl font-extrabold tabular-nums text-teal">
                <Clock className="h-4 w-4" /> 2d 14:03:27
              </p>
            </div>
            <div className="ml-auto w-4/5 rounded-2xl rounded-br-md bg-teal p-2.5 text-[11px] leading-snug text-white">
              It happened again last night.
            </div>
            <div className="w-4/5 rounded-2xl rounded-bl-md bg-white p-2.5 text-[11px] leading-snug shadow-soft">
              <b className="text-navy/50">Committee</b>
              <br />
              Thank you. We are acting on this today.
            </div>
            <div className="h-2" />
          </div>
        </div>
      </div>
      </div>
      </div>

      {/* floating chips */}
      <div className="float-slow glass absolute left-0 top-24 flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold shadow-soft">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy text-white">
          <EyeOff className="h-3.5 w-3.5" />
        </span>
        Identity hidden
      </div>
      <div className="float glass absolute right-0 top-56 flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold shadow-soft">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal text-white">
          <ShieldCheck className="h-3.5 w-3.5" />
        </span>
        Integrity verified
      </div>
      <div className="float-slow glass absolute bottom-2 left-2 flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold shadow-soft">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber text-white">
          <MessageCircle className="h-3.5 w-3.5" />
        </span>
        Closes only when you agree
      </div>
    </div>
  );
}
