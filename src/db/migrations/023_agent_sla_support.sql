-- 023_agent_sla_support.sql
--
-- Agent SLA / speed-to-lead enforcement (CRM spec, Section 4) -- was never
-- built at all: agent_penalties existed but nothing ever wrote to it, and
-- there was no timeout/reassignment cron. This adds the two columns that
-- automated enforcement needs:
--   is_on_duty            -- an agent's own toggle for "available right now",
--                             defaults true so nobody is silently excluded
--                             from the round-robin until they opt out
--   last_lead_assigned_at -- drives fair round-robin assignment order
--                             (oldest-assigned-first), same ORDER BY pattern
--                             the spec itself used

ALTER TABLE users ADD COLUMN is_on_duty boolean NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN last_lead_assigned_at timestamptz;
