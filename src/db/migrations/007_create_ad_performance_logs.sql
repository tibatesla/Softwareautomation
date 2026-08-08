-- 007_create_ad_performance_logs.sql

CREATE TABLE ad_performance_logs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform         ad_platform NOT NULL,
  campaign_id      text NOT NULL,
  ad_id            text NOT NULL,
  window_start     timestamptz NOT NULL, -- hourly bucket
  impressions      integer NOT NULL DEFAULT 0,
  clicks           integer NOT NULL DEFAULT 0,
  spend            numeric(12,2) NOT NULL DEFAULT 0,
  currency         char(3) NOT NULL DEFAULT 'KES',
  qualified_leads  integer NOT NULL DEFAULT 0,
  ctr numeric(6,3) GENERATED ALWAYS AS (
    CASE WHEN impressions > 0 THEN round((clicks::numeric / impressions) * 100, 3) END
  ) STORED,
  cpql numeric(12,2) GENERATED ALWAYS AS (
    CASE WHEN qualified_leads > 0 THEN round(spend / qualified_leads, 2) END
  ) STORED,
  logged_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, campaign_id, ad_id, window_start)
);

CREATE INDEX idx_adperf_platform_ad_window ON ad_performance_logs (platform, ad_id, window_start);
CREATE INDEX idx_adperf_window ON ad_performance_logs (window_start);

-- Owner/Admin-only surface -- agents get no policy, so no rows.
ALTER TABLE ad_performance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_performance_logs FORCE ROW LEVEL SECURITY;

CREATE POLICY adperf_owner_admin_all ON ad_performance_logs
  USING (current_setting('app.current_role', true) IN ('owner', 'admin'));

GRANT SELECT, INSERT, UPDATE ON ad_performance_logs TO app_user;
