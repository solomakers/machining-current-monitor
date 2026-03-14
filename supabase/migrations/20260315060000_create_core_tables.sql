-- Migration: Create core tables for EnOcean current monitoring system
-- Tables: gateways, devices, telemetry_events, gateway_heartbeats

-- =============================================================================
-- gateways
-- =============================================================================
CREATE TABLE gateways (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  site_code     text CHECK (char_length(site_code) BETWEEN 1 AND 50),
  status        text NOT NULL DEFAULT 'offline'
                  CHECK (status IN ('online', 'degraded', 'offline')),
  last_seen_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_gateways_site_code ON gateways (site_code) WHERE site_code IS NOT NULL;
CREATE INDEX idx_gateways_status    ON gateways (status);

-- =============================================================================
-- devices
-- =============================================================================
CREATE TABLE devices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enocean_device_id text NOT NULL UNIQUE
                      CHECK (char_length(enocean_device_id) BETWEEN 1 AND 64),
  machine_id        text CHECK (char_length(machine_id) BETWEEN 1 AND 64),
  machine_name      text CHECK (char_length(machine_name) BETWEEN 1 AND 200),
  site_code         text CHECK (char_length(site_code) BETWEEN 1 AND 50),
  installed_at      timestamptz,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_devices_machine_id ON devices (machine_id) WHERE machine_id IS NOT NULL;
CREATE INDEX idx_devices_site_code  ON devices (site_code) WHERE site_code IS NOT NULL;
CREATE INDEX idx_devices_is_active  ON devices (is_active);

-- =============================================================================
-- telemetry_events
-- =============================================================================
CREATE TABLE telemetry_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          text NOT NULL UNIQUE
                      CHECK (char_length(event_id) BETWEEN 16 AND 128),
  gateway_id        text NOT NULL CHECK (char_length(gateway_id) BETWEEN 1 AND 100),
  device_id         text NOT NULL CHECK (char_length(device_id) BETWEEN 1 AND 64),
  machine_id        text CHECK (char_length(machine_id) BETWEEN 1 AND 64),
  observed_at       timestamptz NOT NULL,
  received_at       timestamptz NOT NULL,
  phase_l1_current_a numeric,
  phase_l2_current_a numeric,
  phase_l3_current_a numeric,
  ct_model_l1       text,
  ct_model_l2       text,
  ct_model_l3       text,
  raw_payload_hex   text NOT NULL CHECK (raw_payload_hex ~ '^[0-9a-fA-F]+$'),
  parser_version    text NOT NULL CHECK (char_length(parser_version) BETWEEN 1 AND 32),
  rssi              integer CHECK (rssi BETWEEN -150 AND 20),
  repeater_count    integer CHECK (repeater_count BETWEEN 0 AND 3),
  source            text NOT NULL DEFAULT 'enocean-usb400j'
                      CHECK (source = 'enocean-usb400j'),
  inserted_at       timestamptz NOT NULL DEFAULT now()
);

-- Primary query patterns: by device + time, by gateway + time
CREATE INDEX idx_telemetry_device_observed
  ON telemetry_events (device_id, observed_at DESC);
CREATE INDEX idx_telemetry_gateway_observed
  ON telemetry_events (gateway_id, observed_at DESC);
CREATE INDEX idx_telemetry_observed_at
  ON telemetry_events (observed_at DESC);
CREATE INDEX idx_telemetry_inserted_at
  ON telemetry_events (inserted_at DESC);

-- =============================================================================
-- gateway_heartbeats
-- =============================================================================
CREATE TABLE gateway_heartbeats (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway_id    text NOT NULL CHECK (char_length(gateway_id) BETWEEN 1 AND 100),
  status        text NOT NULL CHECK (status IN ('online', 'degraded', 'offline')),
  sent_at       timestamptz NOT NULL,
  spool_depth   integer NOT NULL DEFAULT 0 CHECK (spool_depth >= 0),
  serial_port   text,
  app_version   text,
  uptime_sec    integer CHECK (uptime_sec >= 0),
  last_received_at     timestamptz,
  last_sent_success_at timestamptz,
  meta_json     jsonb,
  inserted_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_heartbeat_gateway_sent
  ON gateway_heartbeats (gateway_id, sent_at DESC);

-- =============================================================================
-- unknown_devices (for tracking unregistered EnOcean devices)
-- =============================================================================
CREATE TABLE unknown_devices (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id           text NOT NULL UNIQUE CHECK (char_length(device_id) BETWEEN 1 AND 64),
  gateway_id          text,
  first_seen_at       timestamptz NOT NULL DEFAULT now(),
  last_seen_at        timestamptz NOT NULL DEFAULT now(),
  seen_count          integer NOT NULL DEFAULT 1 CHECK (seen_count >= 1),
  last_raw_payload_hex text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- updated_at trigger function
-- =============================================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_gateways_updated_at
  BEFORE UPDATE ON gateways
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_devices_updated_at
  BEFORE UPDATE ON devices
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
