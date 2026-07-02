-- Migration 032: stock_master_recon Idempotency 보강
-- 문제: insert-only 구조 → 동일 미해결 불일치가 매일 새 행으로 무한 증가
-- 해결: UNIQUE(recon_date, code, field_name) + upsert 패턴 강제
-- Lock 4: 일 단위 생성물은 UNIQUE + upsert 필수

-- 기존 데이터 중복 정리 (안전: 아직 0건)
-- (stock_master_recon은 현재 비어 있으므로 UNIQUE 추가 즉시 적용 가능)

ALTER TABLE stock_master_recon
  ADD CONSTRAINT stock_master_recon_daily_unique
  UNIQUE (recon_date, code, field_name);

-- 인덱스는 UNIQUE 제약이 자동 생성하므로 기존 idx_stock_master_recon_code 유지
