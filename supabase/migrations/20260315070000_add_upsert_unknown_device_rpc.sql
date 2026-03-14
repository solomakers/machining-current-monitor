-- RPC for atomic upsert of unknown_devices (increment seen_count on conflict)
CREATE OR REPLACE FUNCTION upsert_unknown_device(
  p_device_id    text,
  p_gateway_id   text,
  p_raw_payload_hex text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO unknown_devices (device_id, gateway_id, last_raw_payload_hex)
  VALUES (p_device_id, p_gateway_id, p_raw_payload_hex)
  ON CONFLICT (device_id) DO UPDATE SET
    gateway_id          = EXCLUDED.gateway_id,
    last_seen_at        = now(),
    seen_count          = unknown_devices.seen_count + 1,
    last_raw_payload_hex = EXCLUDED.last_raw_payload_hex;
END;
$$;
