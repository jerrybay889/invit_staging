-- 003: investment_journals 테이블 (User-owned)
-- 투자 일지. calculate-discipline의 주요 입력값.

CREATE TABLE IF NOT EXISTS public.investment_journals (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  journal_date    date        NOT NULL DEFAULT CURRENT_DATE,

  -- 감정 슬라이더 (1=극심한 공포, 3=평온, 5=흥분/FOMO)
  emotion_checkin smallint    NOT NULL CHECK (emotion_checkin BETWEEN 1 AND 5),

  -- 투자 행동
  trade_action    text        NOT NULL DEFAULT 'none',
  -- enum: 'buy' | 'sell' | 'none'
  ticker          text,
  amount          numeric,
  trade_rationale text,       -- 결정 이유 (최대 500자)

  -- 편향 체크
  bias_check      boolean     DEFAULT NULL,

  -- 감정 메모
  emotion_memo    text,

  -- 원칙 준수 (JSONB: principle_id → boolean)
  principle_checks jsonb      DEFAULT '{}',

  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),

  -- Idempotency: 1일 1일지
  CONSTRAINT unique_journal_per_day UNIQUE (user_id, journal_date)
);

CREATE INDEX idx_journals_user_date
  ON public.investment_journals(user_id, journal_date DESC);

-- RLS
ALTER TABLE public.investment_journals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own journals"
  ON public.investment_journals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own journals"
  ON public.investment_journals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own journals"
  ON public.investment_journals FOR UPDATE
  USING (auth.uid() = user_id);
