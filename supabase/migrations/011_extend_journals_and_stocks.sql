-- 011: investment_journals UX 재설계 확장 + stocks 종목 캐시
-- 마스터플랜 0617 — Pillar 1 (투자일지 UX 재설계).
-- 원칙: 기존 컬럼/UNIQUE/RLS 보존. 추가(ADD)만. 기존 calculate-discipline EF 무영향.

-- ── investment_journals 확장 컬럼 (모두 nullable — 기존 저장 로직 호환) ──
ALTER TABLE public.investment_journals
  ADD COLUMN IF NOT EXISTS has_trade            boolean,
  ADD COLUMN IF NOT EXISTS impulse_buy_ticker   text,    -- 사고 싶었지만 참은 종목 (무거래일 충동 신호)
  ADD COLUMN IF NOT EXISTS impulse_sell_ticker  text,    -- 팔고 싶었지만 참은 종목
  ADD COLUMN IF NOT EXISTS trade_reason_tags    jsonb DEFAULT '[]'::jsonb,  -- 매수/매도 이유 다중선택 태그
  ADD COLUMN IF NOT EXISTS principle_compliance text,    -- 'kept' | 'partial' | 'broken' (UI: O / △ / X)
  ADD COLUMN IF NOT EXISTS entry_duration_seconds integer; -- 일지 작성 소요 시간 (B2B 분석 지표)

-- principle_compliance 값 제약 (NULL 허용)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'journals_principle_compliance_check'
  ) THEN
    ALTER TABLE public.investment_journals
      ADD CONSTRAINT journals_principle_compliance_check
      CHECK (principle_compliance IS NULL OR principle_compliance IN ('kept','partial','broken'));
  END IF;
END$$;

-- ── stocks 종목 캐시 (Reference / Admin 계층 — 클라이언트 SELECT 전용) ──
-- 종목 검색 자동완성의 데이터 소스. 초기 starter seed → 추후 KRX 전종목 주1회 동기화(외부 작업).
CREATE TABLE IF NOT EXISTS public.stocks (
  code        text        PRIMARY KEY,              -- 종목코드 (예: '005930')
  name        text        NOT NULL,                 -- 종목명 (예: '삼성전자')
  market      text        NOT NULL DEFAULT 'KOSPI', -- 'KOSPI' | 'KOSDAQ' | 'ETF' | 'KONEX'
  type        text        NOT NULL DEFAULT 'stock', -- 'stock' | 'etf' | 'reit'
  is_active   boolean     DEFAULT true,
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stocks_name ON public.stocks(name);

ALTER TABLE public.stocks ENABLE ROW LEVEL SECURITY;

-- 모든 사용자 읽기 허용 (검색용). 쓰기는 service_role(외부 동기화) 전용 — 정책 미작성으로 차단.
CREATE POLICY "Anyone can read active stocks"
  ON public.stocks FOR SELECT
  USING (is_active = true);
