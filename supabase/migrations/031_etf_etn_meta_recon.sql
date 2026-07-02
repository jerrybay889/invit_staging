-- Migration 031: ETF/ETN 정적 메타 + 정합성 예외 테이블
-- Phase B — KIS .mst 파서 연계 전 스키마 사전 확정 (double migration 회피)

-- ─── 1. etf_meta (ETF 정적 메타데이터) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS etf_meta (
  code                  text        PRIMARY KEY REFERENCES stocks(code) ON DELETE CASCADE,
  issuer_full           text,                        -- 운용사 정식명
  replication_method    text        CHECK (replication_method IN ('PHYSICAL','SYNTHETIC','ACTIVE')),
  underlying_index_full text,                        -- 추적지수 정식명
  expense_ratio         numeric(6,4),                -- 연간 TER (%)
  net_assets_krw        bigint,                      -- 설정원본액 (원)
  inception_date        date,                        -- 상장일
  dividend_policy       text        CHECK (dividend_policy IN ('TR','PR','NONE')),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE etf_meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY etf_meta_select ON etf_meta FOR SELECT TO authenticated USING (true);

-- ─── 2. etn_meta (ETN 정적 메타데이터) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS etn_meta (
  code                  text        PRIMARY KEY REFERENCES stocks(code) ON DELETE CASCADE,
  issuer_full           text,                        -- 발행사 정식명
  underlying_index_full text,                        -- 추적지수 정식명
  credit_rating         text,                        -- 발행사 신용등급 (예: AA-, A+)
  maturity_date         date,                        -- 상환종료일 (stocks.maturity_date와 동기화)
  issue_amount          bigint,                      -- 발행잔액 (원)
  updated_at            timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE etn_meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY etn_meta_select ON etn_meta FOR SELECT TO authenticated USING (true);

-- ─── 3. stock_master_recon (KRX↔KIS 정합성 예외 — Phase B2 reconcile용) ──────────
CREATE TABLE IF NOT EXISTS stock_master_recon (
  recon_id    bigserial   PRIMARY KEY,
  recon_date  date        NOT NULL,
  code        text        NOT NULL,
  severity    text        NOT NULL CHECK (severity IN ('INFO','WARN','ERROR')),
  field_name  text,
  krx_value   text,
  kis_value   text,
  note        text,
  resolved_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE stock_master_recon ENABLE ROW LEVEL SECURITY;
-- Operational 계층 — 클라이언트 접근 차단 (Lock 3)
CREATE INDEX IF NOT EXISTS idx_stock_master_recon_code ON stock_master_recon (code);
CREATE INDEX IF NOT EXISTS idx_stock_master_recon_date ON stock_master_recon (recon_date);
CREATE INDEX IF NOT EXISTS idx_stock_master_recon_severity ON stock_master_recon (severity) WHERE resolved_at IS NULL;

-- ─── 4. recommendation_enabled 자동 비활성화 트리거 ──────────────────────────────
CREATE OR REPLACE FUNCTION stocks_sync_recommendation_enabled()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.listing_status IN ('ADMINISTRATIVE','HALTED','DELISTING_PENDING','DELISTED','MATURED') THEN
    NEW.recommendation_enabled := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stocks_recommendation_enabled ON stocks;
CREATE TRIGGER trg_stocks_recommendation_enabled
  BEFORE INSERT OR UPDATE OF listing_status ON stocks
  FOR EACH ROW EXECUTE FUNCTION stocks_sync_recommendation_enabled();
