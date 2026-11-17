# CampusCare

Anonymous reporting and response for harassment, ragging and grievances in colleges.
Two interfaces: a mobile-first **student app** and a desktop **admin panel** for the committee, the dean and an external authority.

The idea in one line: **verified but anonymous**. Only real students can report, nobody can find out which student did, and a case is not closed until the reporter agrees.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind · shadcn-style UI components · Supabase (Postgres, Storage, Auth, Realtime, RLS) · Gemini API (server-side only) · Recharts · Lucide

## Setup

You need Node.js 18+ and a Supabase project (the free tier is enough).

1. Install dependencies

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill it in (see the table below).

3. Create the tables, policies and storage buckets

   ```bash
   npm run db:setup
   ```

   This needs `SUPABASE_DB_URL`. If you'd rather not use it, open the Supabase SQL editor and run
   `supabase/migrations/0001_init.sql`, then `0002_cron.sql` (optional).

4. Load the demo data

   ```bash
   npm run seed
   ```

5. Start the app

   ```bash
   npm run dev
   ```

   Student app: http://localhost:3000 · Admin panel: http://localhost:3000/admin

### Environment variables

| Variable | What it is |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (used for admin sign-in and Realtime) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key. Server only. Never exposed to the browser |
| `SUPABASE_DB_URL` | Postgres connection string, used only by `npm run db:setup` |
| `GEMINI_API_KEY` | Gemini key. If empty, the app uses simple rule-based fallbacks so it still runs |
| `GEMINI_MODEL` | Model name, default `gemini-2.5-flash` |
| `ANON_SECRET` | Long random string. HMAC secret for anonymous ids and session signing. **Changing it orphans existing reports from their reporters** |
| `ENCRYPTION_KEY` | Optional separate key for encrypting raw report text (falls back to `ANON_SECRET`) |
| `DEMO_MODE` | `true` shows the demo controls and the tap-to-fill login hints |

### Demo accounts

`npm run seed` creates 6 students, 3 admins (committee, dean, external) and 32 reports.
Roll numbers, admin emails and the shared demo password are in [`src/lib/demo.ts`](src/lib/demo.ts).
With `DEMO_MODE=true` the login screens have a tap-to-fill hint, so you don't need to type them.
Seeding wipes existing reports, so you can re-run it to reset before a demo.

## Demo script

Use two browser windows: the student app on the left (phone width looks best), the admin panel on the right.

1. **Student logs in.** On the home page tap the demo hint under *Login with ERP* and continue.
2. **Files a report with a voice note.** Tap *Add a voice note* and say something like: "Some seniors made us stand in the common room and shouted at us." Deliberately leave out where and when. Stop recording and continue. Skip the location and time pickers.
3. **AI asks for the missing detail.** Tap *Review*. The app asks when and where it happened. Answer "Hostel A, last night around midnight" and submit.
4. **Gets a case code.** The case code and passphrase are shown once. Copy them, then open *Track my case*.
5. **Admin sees the scrubbed brief.** Sign in as *Committee*. The new case is at the top of the inbox tagged **High**. Open it: the AI brief is neutral and third person, the evidence shows its SHA-256, and *View original* asks for confirmation and writes to the audit log.
6. **Admin uploads vague proof.** In *Proof of action* type "Matter resolved. Students warned." and add it. The AI check flags it as boilerplate.
7. **Admin requests closure.** The button is now enabled.
8. **Student rejects.** On the student's case page the proof is shown with *Accept* and *Reject*. Reject it.
9. **Case reopens and escalates to the Dean.** The admin case view shows *Reopened* and *With: Dean*, and the committee account becomes read-only for it.
10. **Fast-forward.** In *Demo controls* press **+7 days**. Overdue cases move up a level, and the inbox levels and countdowns change.
11. **Heatmap.** Open *Hotspots*: Hostel A at night is the darkest cell. Cells with fewer than 3 reports say "Not enough data".
12. **Tamper.** Open any case and press **Tamper with a log row**. The integrity badge turns red on both the admin and the student view. *Undo tampering* puts it back.

Other things worth showing: the anonymous chat (both windows update live), *Trigger day-7 follow-up* on a closed case ("Has it stopped?" appears for the student), the *Accountability* page, and *Quick exit*.

## How anonymity is protected

- **The ERP only verifies.** Login goes through `ErpAdapter` (`src/lib/erp/adapter.ts`). It answers "is this a real student?" and nothing else. It is never told a report was filed. A real college ERP can replace `MockErpAdapter` without touching anything else.
- **One-way anonymous id.** After a successful login the server computes `anon_id = HMAC_SHA256(ANON_SECRET, roll_no)` and puts only that in a signed, httpOnly session cookie. The roll number is not stored in the session, in a report, or in any log.
- **Admins cannot reach identities.** RLS is on for every table. Admins have read access to a fixed list of report columns that excludes `anon_id`, the encrypted text and the passphrase hash, and no access at all to `erp_students`. Everything else goes through server code with the service role.
- **Scrubbed by default.** Admins read an AI-written summary with bystander names, identifying details and writing style removed. The original text is stored with AES-256-GCM. Opening it requires a confirmation and adds an audit entry that the reporter can see in their timeline.
- **Evidence.** EXIF data (GPS, device) is stripped from photos in the browser before upload. Each file's SHA-256 is recorded. Files sit in private buckets and are served through short-lived signed links.
- **Case code and passphrase.** Shown once. The passphrase is stored only as a bcrypt hash. Together they open the case from any device without logging in.
- **k-anonymity on analytics.** Heatmap cells and category bars with fewer than 3 reports are hidden.
- **Tamper-evident history.** Every event is appended to a hash chain: `hash = sha256(prev_hash + event_type + JSON(payload) + created_at)`. The chain is recomputed on every case view.

### Known limits of this MVP

- Chat uses Realtime *broadcast* on a channel named after the case's internal id, as a "new message" ping only; message contents always travel through authenticated server actions.
- The duplicate check and the dismissed-refile rule rely on the AI's description of the accused, so they are approximate.
- `anon_id` is stable per student, which is what makes the monthly rate limit possible. Anyone holding both `ANON_SECRET` and the ERP roll list could recompute it, so the secret must be kept away from college staff (for example held by the external authority).

## How the pieces fit

| Area | Where |
|---|---|
| Student actions (login, submit, chat, closure, follow-up) | `src/app/actions.ts` |
| Admin actions and demo controls | `src/app/admin/actions.ts` |
| AI prompts, zod schemas and fallbacks | `src/lib/ai.ts` |
| Audit hash chain | `src/lib/audit.ts` |
| Deadlines and escalation (`checkEscalations`) | `src/lib/escalation.ts`, mirrored for pg_cron in `0001_init.sql` |
| Demo clock | `src/lib/clock.ts` |
| Schema, RLS, grants, buckets | `supabase/migrations/` |

Deadlines: critical 24 h, high 72 h, normal 7 days. When one passes, the case moves committee → dean → external and the timer restarts. This runs on every admin page load and every 10 minutes through pg_cron.
Limits: 3 reports per student per month; a claim dismissed for the same accused and location can only be refiled with new evidence.
