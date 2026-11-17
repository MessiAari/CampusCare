-- CampusCare schema. Safe to re-run.

-- ---------- tables ----------
create table if not exists erp_students (
  roll_no text primary key,
  password_hash text not null,
  name text not null,
  department text,
  hostel text
);

create table if not exists admins (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role text not null check (role in ('committee','dean','external'))
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  case_code text unique not null,
  passphrase_hash text not null,
  anon_id text not null,
  raw_text_encrypted text not null,
  scrubbed_summary text not null,
  category text not null check (category in ('ragging','sexual harassment','bullying','discrimination','grievance','other')),
  urgency text not null check (urgency in ('critical','high','normal')),
  spam_score numeric not null default 0,
  self_harm_flag boolean not null default false,
  location text,
  time_of_day text,
  accused_descriptor text,
  status text not null default 'open' check (status in ('open','in_progress','pending_confirmation','closed','reopened','dismissed')),
  escalation_level int not null default 0 check (escalation_level between 0 and 2),
  deadline_at timestamptz not null,
  assigned_to uuid references admins(id) on delete set null,
  duplicate_of uuid references reports(id) on delete set null,
  plus_one_count int not null default 0,
  reopen_count int not null default 0,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_with_acceptance boolean
);
create index if not exists reports_anon_idx on reports(anon_id);
create index if not exists reports_loc_idx on reports(location, status);

create table if not exists evidence (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id) on delete cascade,
  storage_path text not null,
  file_name text,
  mime_type text,
  sha256 text not null,
  uploaded_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id) on delete cascade,
  sender text not null check (sender in ('reporter','admin')),
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists messages_report_idx on messages(report_id, created_at);

create table if not exists proof_of_action (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id) on delete cascade,
  admin_id uuid references admins(id) on delete set null,
  description text not null,
  file_path text,
  ai_boilerplate_flag boolean not null default false,
  ai_note text,
  created_at timestamptz not null default now()
);

create table if not exists followups (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id) on delete cascade,
  due_at timestamptz not null,
  answered boolean not null default false,
  answer text check (answer in ('stopped','not_stopped'))
);

create table if not exists audit_log (
  id bigserial primary key,
  report_id uuid not null references reports(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  actor text not null,
  prev_hash text not null,
  hash text not null,
  created_at timestamptz not null
);
create index if not exists audit_report_idx on audit_log(report_id, id);

create table if not exists rate_limits (
  anon_id text not null,
  month text not null,
  count int not null default 0,
  primary key (anon_id, month)
);

-- demo clock offset etc.
create table if not exists app_settings (
  key text primary key,
  value jsonb not null
);

-- ---------- access control ----------
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where id = auth.uid());
$$;

alter table erp_students enable row level security;
alter table admins enable row level security;
alter table reports enable row level security;
alter table evidence enable row level security;
alter table messages enable row level security;
alter table proof_of_action enable row level security;
alter table followups enable row level security;
alter table audit_log enable row level security;
alter table rate_limits enable row level security;
alter table app_settings enable row level security;

-- Nothing is reachable with the anon key. Signed-in admins get read-only access to a
-- restricted set of tables and, for reports, a restricted set of columns:
-- never anon_id, raw_text_encrypted or passphrase_hash, and never erp_students.
revoke all on erp_students, admins, reports, evidence, messages, proof_of_action,
  followups, audit_log, rate_limits, app_settings from anon, authenticated;
revoke all on sequence audit_log_id_seq from anon, authenticated;

grant all on erp_students, admins, reports, evidence, messages, proof_of_action,
  followups, audit_log, rate_limits, app_settings to service_role;
grant usage, select on sequence audit_log_id_seq to service_role;

grant select (
  id, case_code, scrubbed_summary, category, urgency, spam_score, self_harm_flag,
  location, time_of_day, accused_descriptor, status, escalation_level, deadline_at,
  assigned_to, duplicate_of, plus_one_count, reopen_count, created_at, closed_at,
  closed_with_acceptance
) on reports to authenticated;
grant select on admins, evidence, messages, proof_of_action, followups, audit_log to authenticated;

drop policy if exists admin_read on reports;
create policy admin_read on reports for select to authenticated using (is_admin());
drop policy if exists admin_read on admins;
create policy admin_read on admins for select to authenticated using (is_admin());
drop policy if exists admin_read on evidence;
create policy admin_read on evidence for select to authenticated using (is_admin());
drop policy if exists admin_read on messages;
create policy admin_read on messages for select to authenticated using (is_admin());
drop policy if exists admin_read on proof_of_action;
create policy admin_read on proof_of_action for select to authenticated using (is_admin());
drop policy if exists admin_read on followups;
create policy admin_read on followups for select to authenticated using (is_admin());
drop policy if exists admin_read on audit_log;
create policy admin_read on audit_log for select to authenticated using (is_admin());
-- erp_students, rate_limits, app_settings: no policies, so only the service role can touch them.

-- ---------- storage (private buckets, service role only) ----------
insert into storage.buckets (id, name, public) values ('evidence', 'evidence', false)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('proof', 'proof', false)
  on conflict (id) do nothing;

-- ---------- escalation, callable from cron ----------
-- Mirrors checkEscalations() in src/lib/escalation.ts, including the audit hash:
-- sha256(prev_hash + event_type + canonical JSON(payload) + ISO created_at).
create or replace function check_escalations_cron() returns int
language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
  v_off bigint;
  v_now timestamptz;
  v_ts timestamptz;
  v_prev text;
  v_payload text;
  v_hours int;
begin
  select coalesce((value->>'ms')::bigint, 0) into v_off from app_settings where key = 'clock_offset';
  v_now := now() + make_interval(secs => coalesce(v_off, 0) / 1000.0);
  v_ts := date_trunc('milliseconds', v_now);
  for r in
    select * from reports
    where status in ('open','in_progress','reopened')
      and escalation_level < 2 and deadline_at < v_now
  loop
    v_hours := case r.urgency when 'critical' then 24 when 'high' then 72 else 168 end;
    update reports
      set escalation_level = r.escalation_level + 1,
          deadline_at = v_now + make_interval(hours => v_hours)
      where id = r.id;
    select hash into v_prev from audit_log where report_id = r.id order by id desc limit 1;
    v_prev := coalesce(v_prev, 'GENESIS');
    v_payload := format('{"from":%s,"reason":"deadline_missed","to":%s}',
      r.escalation_level, r.escalation_level + 1);
    insert into audit_log (report_id, event_type, payload, actor, prev_hash, hash, created_at)
    values (
      r.id, 'escalated', v_payload::jsonb, 'system', v_prev,
      encode(sha256(convert_to(
        v_prev || 'escalated' || v_payload ||
        to_char(v_ts at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'UTF8')), 'hex'),
      v_ts
    );
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function check_escalations_cron() from public, anon, authenticated;
