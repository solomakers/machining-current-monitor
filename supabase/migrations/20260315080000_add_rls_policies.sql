-- =============================================================================
-- Enable RLS on all tables
-- =============================================================================
ALTER TABLE gateways             ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices              ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE gateway_heartbeats   ENABLE ROW LEVEL SECURITY;
ALTER TABLE unknown_devices      ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- telemetry_events
-- Edge Functions (service_role) can insert; authenticated users can read
-- =============================================================================
CREATE POLICY "service_role can insert telemetry"
  ON telemetry_events FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "authenticated users can read telemetry"
  ON telemetry_events FOR SELECT
  TO authenticated
  USING (true);

-- =============================================================================
-- gateway_heartbeats
-- Edge Functions (service_role) can insert; authenticated users can read
-- =============================================================================
CREATE POLICY "service_role can insert heartbeats"
  ON gateway_heartbeats FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "authenticated users can read heartbeats"
  ON gateway_heartbeats FOR SELECT
  TO authenticated
  USING (true);

-- =============================================================================
-- gateways
-- service_role can manage; authenticated users can read
-- =============================================================================
CREATE POLICY "service_role can manage gateways"
  ON gateways FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated users can read gateways"
  ON gateways FOR SELECT
  TO authenticated
  USING (true);

-- =============================================================================
-- devices
-- service_role can manage; authenticated users can read
-- =============================================================================
CREATE POLICY "service_role can manage devices"
  ON devices FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated users can read devices"
  ON devices FOR SELECT
  TO authenticated
  USING (true);

-- =============================================================================
-- unknown_devices
-- service_role can manage; authenticated users can read
-- =============================================================================
CREATE POLICY "service_role can manage unknown_devices"
  ON unknown_devices FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated users can read unknown_devices"
  ON unknown_devices FOR SELECT
  TO authenticated
  USING (true);
