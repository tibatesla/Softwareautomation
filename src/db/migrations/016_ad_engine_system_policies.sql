-- 016_ad_engine_system_policies.sql
--
-- Module 4's cron jobs and the BullMQ worker have no logged-in user (same
-- situation as the WhatsApp webhook in Module 3), so they run under
-- withSystemContext(). ad_performance_logs, ad_rule_executions, and
-- system_secrets currently only have owner/admin policies -- without a
-- 'system' policy on each, RLS silently blocks all of Module 4's own
-- writes and reads.

CREATE POLICY adperf_system_all ON ad_performance_logs
  USING (current_setting('app.current_role', true) = 'system');

CREATE POLICY adrules_system_all ON ad_rule_executions
  USING (current_setting('app.current_role', true) = 'system');

CREATE POLICY secrets_system_all ON system_secrets
  USING (current_setting('app.current_role', true) = 'system');
