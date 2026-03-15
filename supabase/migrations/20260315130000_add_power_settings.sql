-- devices テーブルに電力計算用カラムを追加
-- phase_type: '3phase' (三相交流) or '1phase' (単相交流)
-- voltage_v: 線間電圧 (日本の工場では通常 200V または 400V)
-- power_factor: 力率 (0.0〜1.0, 一般的な工作機械は 0.7〜0.85)
ALTER TABLE devices
  ADD COLUMN phase_type text NOT NULL DEFAULT '3phase' CHECK (phase_type IN ('3phase', '1phase')),
  ADD COLUMN voltage_v numeric(6,1) NOT NULL DEFAULT 200.0 CHECK (voltage_v > 0),
  ADD COLUMN power_factor numeric(3,2) NOT NULL DEFAULT 0.80 CHECK (power_factor > 0 AND power_factor <= 1.0);

COMMENT ON COLUMN devices.phase_type IS '交流種別: 3phase=三相, 1phase=単相';
COMMENT ON COLUMN devices.voltage_v IS '線間電圧 (V) - 電力計算に使用';
COMMENT ON COLUMN devices.power_factor IS '力率 (cosφ) - 電力計算に使用';
