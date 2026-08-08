-- 008_create_ad_rule_executions.sql

CREATE TABLE ad_rule_executions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_performance_log_id uuid REFERENCES ad_performance_logs(id), -- nullable: e.g. token-failure entries have no perf row
  rule_name             text NOT NULL,
  platform              ad_platform,
  campaign_id           text,
  ad_id                 text,
  action_taken          text NOT NULL, -- 'paused' | 'throttled' | 'budget_increased' | 'none' | 'failed'
  reason                text,
  success               boolean NOT NULL DEFAULT true,
  error_detail          text,
  executed_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_adrules_executed_at ON ad_rule_executions (executed_at);
CREATE INDEX idx_adrules_platform_ad ON ad_rule_executions (platform, ad_id);

ALTER TABLE ad_rule_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_rule_executions FORCE ROW LEVEL SECURITY;

CREATE POLICY adrules_owner_admin_all ON ad_rule_executions
  USING (current_setting('app.current_role', true) IN ('owner', 'admin'));

GRANT SELECT, INSERT ON ad_rule_executions TO app_user;
