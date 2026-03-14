-- Gateway
INSERT INTO gateways (name, site_code, status)
VALUES ('gw-tokyo-001', 'TOKYO-01', 'offline')
ON CONFLICT DO NOTHING;

-- Sample device
INSERT INTO devices (enocean_device_id, machine_id, machine_name, site_code, is_active)
VALUES ('01-02-03-04', 'MC-001', 'テスト加工機1号', 'TOKYO-01', true)
ON CONFLICT (enocean_device_id) DO NOTHING;
