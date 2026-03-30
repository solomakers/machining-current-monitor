-- phase_type の値を '1phase' → '1phase3w' に変更し、CHECK制約を更新
-- 単相3線式: 100V × (L1+L2) × cosφ
-- 三相3線式: 200V × avg(L1,L2,L3) × cosφ

UPDATE devices SET phase_type = '1phase3w' WHERE phase_type = '1phase';

ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_phase_type_check;
ALTER TABLE devices ADD CONSTRAINT devices_phase_type_check CHECK (phase_type IN ('3phase', '1phase3w'));

COMMENT ON COLUMN devices.phase_type IS '交流種別: 3phase=三相3線式, 1phase3w=単相3線式';
