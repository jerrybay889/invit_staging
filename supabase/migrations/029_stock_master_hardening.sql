-- Migration 029: Stock Master Hardening
-- Phase A — 마스터 하드닝: 상폐 처리·델타·감사·안전장치
-- INVIT SSOT Lock 3: RLS 선적용, Lock 4: Idempotency

-- ─── 1. stocks 테이블 컬럼 확장 ───────────────────────────────────────────────
-- 모두 nullable/default → 기존 RLS·SELECT 정책·EF 무영향

ALTER TABLE stocks ADD COLUMN IF NOT EXISTS isin text;

ALTER TABLE stocks ADD COLUMN IF NOT EXISTS listing_status text NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE stocks ADD CONSTRAINT stocks_listing_status_check
  CHECK (listing_status IN ('ACTIVE','CAUTION','ADMINISTRATIVE','HALTED','DELISTING_PENDING','DELISTED'));

ALTER TABLE stocks ADD COLUMN IF NOT EXISTS search_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE stocks ADD COLUMN IF NOT EXISTS recommendation_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE stocks ADD COLUMN IF NOT EXISTS row_hash text;
ALTER TABLE stocks ADD COLUMN IF NOT EXISTS source_system text NOT NULL DEFAULT 'KRX_DATAGO';
ALTER TABLE stocks ADD COLUMN IF NOT EXISTS source_as_of_date date;
ALTER TABLE stocks ADD COLUMN IF NOT EXISTS first_seen_at timestamptz DEFAULT now();
ALTER TABLE stocks ADD COLUMN IF NOT EXISTS last_changed_at timestamptz;
ALTER TABLE stocks ADD COLUMN IF NOT EXISTS delisted_at timestamptz;

-- listing_status 인덱스 (상태별 필터링)
CREATE INDEX IF NOT EXISTS idx_stocks_listing_status ON stocks (listing_status);

-- search_enabled 부분 인덱스 (검색 대상만 빠르게)
CREATE INDEX IF NOT EXISTS idx_stocks_search_enabled ON stocks (code) WHERE search_enabled = true;

-- ─── 2. stock_change_log (Operational 계층) ────────────────────────────────────
-- INSERT/UPDATE/INACTIVATE/REACTIVATE 이력 — 클라이언트 접근 차단, service_role 전용

CREATE TABLE IF NOT EXISTS stock_change_log (
  change_id    bigserial PRIMARY KEY,
  change_date  date         NOT NULL,
  code         text         NOT NULL,
  change_type  text         NOT NULL, -- INSERT | UPDATE | INACTIVATE | REACTIVATE
  changed_columns jsonb,
  before_hash  text,
  after_hash   text,
  source_as_of_date date,
  created_at   timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_change_log_code ON stock_change_log (code);
CREATE INDEX IF NOT EXISTS idx_stock_change_log_date ON stock_change_log (change_date);

ALTER TABLE stock_change_log ENABLE ROW LEVEL SECURITY;
-- 정책 미작성 = 클라이언트 전면 차단 (Lock 3: Operational 계층)

-- ─── 3. stock_sync_runs (Operational 계층) ────────────────────────────────────
-- 배치 감사/모니터링 — RUNNING/SUCCESS/ABORTED 상태 추적

CREATE TABLE IF NOT EXISTS stock_sync_runs (
  run_id        bigserial PRIMARY KEY,
  as_of_date    date,
  source_system text         NOT NULL DEFAULT 'KRX_DATAGO',
  status        text         NOT NULL DEFAULT 'RUNNING', -- RUNNING | SUCCESS | ABORTED
  total_fetched int          DEFAULT 0,
  inserted      int          DEFAULT 0,
  updated       int          DEFAULT 0,
  inactivated   int          DEFAULT 0,
  unchanged     int          DEFAULT 0,
  anomaly_note  text,
  started_at    timestamptz  NOT NULL DEFAULT now(),
  finished_at   timestamptz
);

ALTER TABLE stock_sync_runs ENABLE ROW LEVEL SECURITY;
-- 정책 미작성 = 클라이언트 전면 차단 (Lock 3: Operational 계층)
