-- 004: discipline_logs 테이블 (System-generated)
-- calculate-discipline EF 전용. append-only + Idempotency.

CREATE TABLE IF NOT EXISTS public.discipline_logs (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  log_date        date        NOT NULL DEFAULT CURRENT_DATE,

  -- 구성 점수
  journal_score   smallint    NOT NULL DEFAULT 0 CHECK (journal_score BETWEEN 0 AND 100),
  principle_score smallint    NOT NULL DEFAULT 0 CHECK (principle_score BETWEEN 0 AND 100),
  emotion_score   smallint    NOT NULL DEFAULT 0 CHECK (emotion_score BETWEEN 0 AND 100),

  -- 최종 점수 (40/40/20 가중 합산)
  total_score     smallint    NOT NULL DEFAULT 0 CHECK (total_score BETWEEN 0 AND 100),

  -- 산출 상세 (디버깅용)
  calculation_detail jsonb    DEFAULT NULL,

  created_at      timestamptz DEFAULT now(),

  -- Idempotency: 1일 1점수
  CONSTRAINT unique_discipline_per_day UNIQUE (user_id, log_date)
);

CREATE INDEX idx_discipline_user_date
  ON public.discipline_logs(user_id, log_date DESC);

-- RLS
ALTER TABLE public.discipline_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own discipline"
  ON public.discipline_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role insert/update only"
  ON public.discipline_logs FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role update"
  ON public.discipline_logs FOR UPDATE
  USING (auth.role() = 'service_role');
