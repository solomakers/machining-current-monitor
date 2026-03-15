-- =============================================================================
-- alert_rules (threshold configuration per device)
-- =============================================================================
CREATE TABLE alert_rules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id   uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  phase       text NOT NULL CHECK (phase IN ('l1', 'l2', 'l3', 'any')),
  condition   text NOT NULL CHECK (condition IN ('above', 'below')),
  threshold_a numeric(8,2) NOT NULL CHECK (threshold_a >= 0),
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_alert_rules_device ON alert_rules (device_id);

CREATE TRIGGER set_alert_rules_updated_at
  BEFORE UPDATE ON alert_rules
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================================
-- alerts (triggered alert events)
-- =============================================================================
CREATE TABLE alerts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id      uuid REFERENCES alert_rules(id) ON DELETE SET NULL,
  device_id    uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  machine_name text,
  alert_type   text NOT NULL,
  severity     text NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  message      text NOT NULL,
  value_a      numeric(8,2),
  threshold_a  numeric(8,2),
  started_at   timestamptz NOT NULL DEFAULT now(),
  ended_at     timestamptz,
  acknowledged boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_alerts_device     ON alerts (device_id);
CREATE INDEX idx_alerts_started_at ON alerts (started_at DESC);
CREATE INDEX idx_alerts_active     ON alerts (ended_at) WHERE ended_at IS NULL;

-- =============================================================================
-- RLS policies
-- =============================================================================
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role can manage alert_rules"
  ON alert_rules FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "authenticated can read alert_rules"
  ON alert_rules FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated can insert alert_rules"
  ON alert_rules FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated can update alert_rules"
  ON alert_rules FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated can delete alert_rules"
  ON alert_rules FOR DELETE
  USING (auth.role() = 'authenticated');

CREATE POLICY "service_role can manage alerts"
  ON alerts FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "authenticated can read alerts"
  ON alerts FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated can update alerts"
  ON alerts FOR UPDATE
  USING (auth.role() = 'authenticated');
