-- Migration 030: Stock Asset Type — ETF 회귀 복구 + 자산유형 거버넌스 스키마
-- Phase A+: ETF 시드 8종 즉시 복구 (Phase A INACTIVATE 회귀 수정)
-- Phase A++ 준비: asset_type/product_subtype/issuer/maturity_date 컬럼

-- ─── 1. listing_status CHECK에 MATURED 추가 (ETN 만기 ≠ 상폐 구분) ──────────────
ALTER TABLE stocks DROP CONSTRAINT IF EXISTS stocks_listing_status_check;
ALTER TABLE stocks ADD CONSTRAINT stocks_listing_status_check
  CHECK (listing_status IN ('ACTIVE','CAUTION','ADMINISTRATIVE','HALTED','DELISTING_PENDING','DELISTED','MATURED'));

-- ─── 2. 자산유형 거버넌스 컬럼 추가 ──────────────────────────────────────────────
ALTER TABLE stocks ADD COLUMN IF NOT EXISTS asset_type text NOT NULL DEFAULT 'STOCK';
DO $$ BEGIN
  ALTER TABLE stocks ADD CONSTRAINT stocks_asset_type_check
    CHECK (asset_type IN ('STOCK','ETF','ETN','ELW','REITS'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE stocks ADD COLUMN IF NOT EXISTS product_subtype text;
DO $$ BEGIN
  ALTER TABLE stocks ADD CONSTRAINT stocks_product_subtype_check
    CHECK (product_subtype IS NULL OR product_subtype IN (
      'VANILLA','LEVERAGE_2X','LEVERAGE_3X','INVERSE_1X','INVERSE_2X','ACTIVE_MGMT','THEMED'
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE stocks ADD COLUMN IF NOT EXISTS underlying_index text;
ALTER TABLE stocks ADD COLUMN IF NOT EXISTS issuer text;
ALTER TABLE stocks ADD COLUMN IF NOT EXISTS maturity_date date;
ALTER TABLE stocks ADD COLUMN IF NOT EXISTS listing_shares bigint;

-- ─── 3. 기존 type 컬럼 기반 asset_type 백필 ────────────────────────────────────
UPDATE stocks SET asset_type = 'ETF'   WHERE type = 'etf';
UPDATE stocks SET asset_type = 'REITS' WHERE type = 'reit';
-- type='stock'은 DEFAULT 'STOCK' 처리됨

-- ─── 4. 시드 ETF 8종 즉시 복구 (Phase A INACTIVATE 회귀) ──────────────────────
UPDATE stocks
SET
  is_active              = true,
  listing_status         = 'ACTIVE',
  search_enabled         = true,
  recommendation_enabled = true,
  delisted_at            = NULL
WHERE type = 'etf' AND listing_status = 'DELISTED';

-- ─── 5. 인덱스 ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_stocks_asset_type        ON stocks (asset_type);
CREATE INDEX IF NOT EXISTS idx_stocks_asset_type_active ON stocks (asset_type, is_active);
