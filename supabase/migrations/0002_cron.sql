-- Optional: run the escalation check every 10 minutes with pg_cron.
-- If this fails (pg_cron not enabled), enable it under Database -> Extensions and re-run.
-- The app also runs the check on every admin page load, so this is a safety net.
create extension if not exists pg_cron;

select cron.unschedule(jobid) from cron.job where jobname = 'campuscare-escalations';
select cron.schedule('campuscare-escalations', '*/10 * * * *', 'select public.check_escalations_cron()');
