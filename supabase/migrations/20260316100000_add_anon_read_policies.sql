-- anon ロールにも SELECT を許可 (ISR/SSR でセッションCookieが渡されないケースに対応)
CREATE POLICY "anon can read telemetry"
  ON telemetry_events FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "anon can read devices"
  ON devices FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "anon can read gateways"
  ON gateways FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "anon can read unknown_devices"
  ON unknown_devices FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "anon can read heartbeats"
  ON gateway_heartbeats FOR SELECT
  TO anon
  USING (true);
