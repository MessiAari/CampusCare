"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { getMessages, sendMessage } from "@/app/actions";
import { getAdminMessages, sendAdminMessage } from "@/app/admin/actions";
import { browserDb } from "@/lib/supabase/browser";
import { cn, fmtDate } from "@/lib/utils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type Msg = { id: string; sender: "reporter" | "admin"; body: string; created_at: string };

/**
 * Anonymous chat. Messages are stored through server actions; Supabase Realtime broadcast tells
 * the other side to refresh. A slow poll covers the case where Realtime is unavailable.
 */
export function Chat({
  mode,
  reportId,
  caseCode,
  disabled,
}: {
  mode: "reporter" | "admin";
  reportId: string;
  caseCode: string;
  disabled?: string;
}) {
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const channelRef = useRef<any>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const data = mode === "admin" ? await getAdminMessages(reportId) : await getMessages(caseCode);
    setMsgs(data as Msg[]);
  }, [mode, reportId, caseCode]);

  useEffect(() => {
    load();
    let channel: any;
    try {
      channel = browserDb()
        .channel(`case-${reportId}`)
        .on("broadcast", { event: "new" }, () => load())
        .subscribe();
      channelRef.current = channel;
    } catch {
      /* realtime is optional */
    }
    const poll = setInterval(load, 8000);
    return () => {
      clearInterval(poll);
      try {
        if (channel) browserDb().removeChannel(channel);
      } catch {}
    };
  }, [load, reportId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [msgs?.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    setError("");
    const res = mode === "admin" ? await sendAdminMessage(reportId, text) : await sendMessage(caseCode, text);
    setSending(false);
    if (!res.ok) return setError(res.error);
    setText("");
    await load();
    try {
      channelRef.current?.send({ type: "broadcast", event: "new", payload: {} });
    } catch {}
  }

  return (
    <div className="flex flex-col">
      <div className="max-h-80 min-h-[8rem] space-y-2 overflow-y-auto rounded-xl bg-cloud p-3">
        {msgs === null && <div className="skeleton h-10 w-2/3" />}
        {msgs?.length === 0 && (
          <p className="py-6 text-center text-sm text-navy/50">
            No messages yet.{" "}
            {mode === "reporter"
              ? "You can write to the committee here. They never see who you are."
              : "Ask the reporter a question. They stay anonymous."}
          </p>
        )}
        {msgs?.map((m) => {
          const mine = m.sender === mode;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm",
                  mine ? "rounded-br-md bg-teal text-white" : "rounded-bl-md bg-white text-navy shadow-soft"
                )}
              >
                <div className={cn("mb-0.5 text-[11px] font-semibold", mine ? "text-white/70" : "text-navy/50")}>
                  {m.sender === "admin" ? "Committee" : mode === "admin" ? "Reporter (anonymous)" : "You"} ·{" "}
                  {fmtDate(m.created_at)}
                </div>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      {disabled ? (
        <p className="mt-2 text-xs text-navy/50">{disabled}</p>
      ) : (
        <form onSubmit={send} className="mt-3 flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a message…"
            aria-label="Message"
            maxLength={2000}
          />
          <Button type="submit" disabled={sending || !text.trim()} aria-label="Send">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      )}
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
