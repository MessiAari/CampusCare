import "server-only";
import { z } from "zod";
import { CATEGORIES, LOCATIONS, TIMES, URGENCIES } from "./constants";

// All AI calls go through Gemini from the server. Every call asks for strict JSON, validates it
// with zod, and falls back to simple rules if the key is missing or the call fails, so the app
// keeps working during a demo with no network.

async function gemini<T>(system: string, user: string, schema: z.ZodType<T, any, any>): Promise<T | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system + "\nRespond with a single JSON object only." }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
        }),
        signal: AbortSignal.timeout(25000),
      }
    );
    if (!res.ok) {
      console.error("[ai] Gemini HTTP", res.status, (await res.text()).slice(0, 300));
      return null;
    }
    const json = await res.json();
    const text: string =
      json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
    const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const parsed = schema.safeParse(JSON.parse(cleaned));
    if (!parsed.success) {
      console.error("[ai] schema mismatch", parsed.error.issues.slice(0, 3));
      return null;
    }
    return parsed.data;
  } catch (e) {
    console.error("[ai] Gemini call failed", e);
    return null;
  }
}

// ---------- clarify ----------
const ClarifySchema = z.object({ questions: z.array(z.string().min(3).max(200)).max(3) });

export async function clarify(input: { text: string; location?: string; time_of_day?: string }) {
  const ai = await gemini(
    `You help a student file an anonymous report about harassment or ragging at a college.
Check whether the report says WHEN it happened, WHERE it happened and WHAT happened.
Return {"questions": string[]} with at most 3 short, kind follow-up questions, one per missing detail.
Never ask who the reporter is or for the names of bystanders. If nothing important is missing return {"questions": []}.`,
    `Report text:\n"""${input.text}"""\nLocation picked: ${input.location || "not given"}\nTime of day picked: ${input.time_of_day || "not given"}`,
    ClarifySchema
  );
  if (ai) return ai;

  const t = input.text.toLowerCase();
  const questions: string[] = [];
  if (!/(today|yesterday|last|ago|night|morning|evening|afternoon|week|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d\s?(am|pm)|\d{1,2}[\/\-]\d{1,2})/.test(t))
    questions.push("Roughly when did this happen? A day or date is enough.");
  if (!input.location && !/(hostel|canteen|library|bus|class|lab|ground|mess|room|corridor|online|whatsapp)/.test(t))
    questions.push("Where did this happen?");
  if (input.text.trim().split(/\s+/).length < 15)
    questions.push("Could you describe what was said or done in a little more detail?");
  return { questions: questions.slice(0, 3) };
}

// ---------- analyze ----------
const AnalyzeSchema = z.object({
  scrubbed_summary: z.string().min(5).max(900),
  category: z.enum(CATEGORIES).catch("other"),
  urgency: z.enum(URGENCIES).catch("normal"),
  spam_score: z.coerce.number().min(0).max(1).catch(0.1),
  self_harm_flag: z.coerce.boolean().catch(false),
  location: z.string().max(60).nullable().catch(null),
  time_of_day: z.enum(TIMES).nullable().catch(null),
  accused_descriptor: z.string().max(160).nullable().catch(null),
});
export type Analysis = z.infer<typeof AnalyzeSchema>;

export async function analyze(input: { text: string; location?: string; time_of_day?: string }): Promise<Analysis> {
  const ai = await gemini(
    `You triage anonymous student reports for a college grievance committee. Return JSON with exactly these keys:
- scrubbed_summary: at most 5 lines, factual, third person ("The reporter states..."). Remove names of bystanders and witnesses, anything that could identify the reporter (room number, roll number, friends, unique personal details) and the reporter's writing style. KEEP the description of the accused.
- category: one of ${CATEGORIES.join(" | ")}
- urgency: critical | high | normal. Use critical for self-harm, threats to life, physical or sexual violence, or ongoing danger. Use high for repeated or targeted harassment and ragging.
- spam_score: 0 to 1, how likely this is a joke, test, abuse of the system or has no real complaint.
- self_harm_flag: true if the reporter or victim mentions self-harm or suicidal thoughts, or there is a threat of serious violence.
- location: one of ${LOCATIONS.join(" | ")}, or null if unknown.
- time_of_day: one of ${TIMES.join(" | ")}, or null if unknown.
- accused_descriptor: short description of the accused as given (for example "three final-year students from the mechanical branch"), or null.`,
    `Report text:\n"""${input.text}"""\nLocation picked by the reporter: ${input.location || "not given"}\nTime of day picked by the reporter: ${input.time_of_day || "not given"}`,
    AnalyzeSchema
  );
  const a = ai ?? fallbackAnalyze(input.text);
  const location = input.location || (LOCATIONS.includes(a.location as any) ? a.location : null) || "Other";
  const time_of_day = (input.time_of_day as Analysis["time_of_day"]) || a.time_of_day || null;
  const urgency = a.self_harm_flag ? "critical" : a.urgency;
  return {
    ...a,
    location,
    time_of_day,
    urgency,
    spam_score: Math.round(a.spam_score * 100) / 100,
    scrubbed_summary: a.scrubbed_summary.split("\n").slice(0, 5).join("\n"),
  };
}

function fallbackAnalyze(text: string): Analysis {
  const t = text.toLowerCase();
  const has = (re: RegExp) => re.test(t);
  const self_harm = has(/(suicid|kill myself|end my life|self[- ]harm|hurt myself|don'?t want to live|kill (him|her|me|you)|weapon|knife)/);
  let category: Analysis["category"] = "other";
  if (has(/(ragging|ragged|senior|seniors|intro|forced to)/)) category = "ragging";
  if (has(/(touch|grope|sexual|molest|stalk|obscene|lewd|inappropriate message)/)) category = "sexual harassment";
  else if (has(/(caste|religion|region|gender|slur|discriminat)/)) category = "discrimination";
  else if (category === "other" && has(/(bully|mock|humiliat|threat|abuse|tease)/)) category = "bullying";
  else if (category === "other" && has(/(fee|mess|food|grade|marks|wifi|warden|faculty|professor)/)) category = "grievance";
  let urgency: Analysis["urgency"] = "normal";
  if (["ragging", "sexual harassment"].includes(category) || has(/(again|every|repeated|daily|threat)/)) urgency = "high";
  if (self_harm || has(/(beat|slap|hit|punch|assault|rape|injur|bleed)/)) urgency = "critical";
  const words = text.trim().split(/\s+/).length;
  const spam = words < 6 || has(/(test|asdf|lol|hahaha|just kidding)/) ? 0.85 : 0.1;
  const tod = (TIMES.find((x) => t.includes(x)) as Analysis["time_of_day"]) ?? null;
  const loc = LOCATIONS.find((l) => t.includes(l.toLowerCase())) ?? null;
  const accused = t.match(/((?:a|an|the|two|three|four|some|few|group of)\s+(?:[a-z-]+\s){0,4}(?:seniors?|students?|boys|girls|warden|professor|faculty|staff|guard)(?:\s(?:from|of)\s(?:the\s)?[a-z ]{3,30})?)/);
  const sentences = text.replace(/\s+/g, " ").split(/(?<=[.!?])\s/).slice(0, 4).join(" ");
  return {
    scrubbed_summary: ("The reporter states: " + sentences).slice(0, 600),
    category,
    urgency,
    spam_score: spam,
    self_harm_flag: self_harm,
    location: loc,
    time_of_day: tod,
    accused_descriptor: accused ? accused[1].trim() : null,
  };
}

// ---------- duplicate check ----------
const DupSchema = z.object({ duplicate_index: z.number().int().nullable().catch(null) });

export async function findDuplicate(
  summary: string,
  accused: string | null,
  candidates: { id: string; scrubbed_summary: string; accused_descriptor: string | null; time_of_day: string | null }[]
): Promise<string | null> {
  if (!candidates.length) return null;
  const ai = await gemini(
    `You compare a new incident report with existing open reports from the same location.
Decide if the new report describes the SAME incident (same event, same people, same occasion) as one of them.
Similar kinds of incident on different occasions are NOT duplicates.
Return {"duplicate_index": <index of the matching report>} or {"duplicate_index": null}.`,
    `NEW REPORT:\n${summary}\n\nEXISTING REPORTS:\n${candidates.map((c, i) => `[${i}] ${c.scrubbed_summary}`).join("\n\n")}`,
    DupSchema
  );
  if (ai) {
    const i = ai.duplicate_index;
    return i !== null && i >= 0 && i < candidates.length ? candidates[i].id : null;
  }
  if (!process.env.GEMINI_API_KEY) {
    // Rule-based fallback: strong word overlap between summaries.
    const tok = (s: string) => new Set(s.toLowerCase().match(/[a-z]{4,}/g) ?? []);
    const a = tok(summary + " " + (accused ?? ""));
    for (const c of candidates) {
      const b = tok(c.scrubbed_summary + " " + (c.accused_descriptor ?? ""));
      const inter = [...a].filter((w) => b.has(w)).length;
      if (a.size > 5 && inter / Math.min(a.size, b.size) > 0.7) return c.id;
    }
  }
  return null;
}

// ---------- proof-of-action check ----------
const ProofSchema = z.object({ boilerplate: z.coerce.boolean(), note: z.string().max(300).catch("") });

export async function checkProof(description: string, caseSummary: string) {
  const ai = await gemini(
    `You audit a college committee's "proof of action" note on a harassment case.
Flag it as boilerplate if it is vague, generic or unverifiable, for example "matter resolved", "students warned", "necessary action taken", with no who / what / when or reference to a document.
Return {"boilerplate": boolean, "note": string}. The note is one short sentence saying what is missing, or why the proof is specific enough.`,
    `Case summary:\n${caseSummary}\n\nProof of action written by the admin:\n"""${description}"""`,
    ProofSchema
  );
  if (ai) return ai;
  const t = description.toLowerCase();
  const words = description.trim().split(/\s+/).length;
  const vague = /(matter (is |was )?(resolved|closed|settled)|students? (were |was )?warned|necessary action|action taken|issue (is |was )?resolved|counsell?ed|looked into|handled)/.test(t);
  const specific = /(\d|notice|order|suspend|fine|letter|meeting on|statement|cctv|committee met|ref|memo)/.test(t);
  const boilerplate = words < 12 || (vague && !specific);
  return {
    boilerplate,
    note: boilerplate
      ? "Too vague to verify: it does not say who acted, what was done, or when, and cites no document."
      : "Names specific actions that can be checked.",
  };
}
