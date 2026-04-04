-- 002: bias_assessments 테이블 (System-generated)
-- Schema LOCK v1.0 — 변경 금지. Jerry 단독 승인 필요.

CREATE TABLE IF NOT EXISTS public.bias_assessments (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  version         smallint    NOT NULL DEFAULT 1,

  -- 7문항 원본 응답 (JSONB)
  -- q1~q3, q5, q7: 1~5 (5-point Likert)
  -- q4: 1~3 (3-point forced choice)
  -- q6: 1~5 (역방향 — 낮을수록 편향↑)
  answers         jsonb       NOT NULL,

  -- 편향 플래그 (Edge Function 자동 산출, 클라이언트 직접 쓰기 금지)
  bias_flags      jsonb       NOT NULL,

  -- 코칭 아키타입 (5종 + mixed)
  archetype       text        NOT NULL,

  -- 편향별 재진단 스케줄
  next_retest_at  jsonb       NOT NULL,

  -- 메타
  diagnosed_at    timestamptz NOT NULL DEFAULT now(),
  trigger_source  text        NOT NULL DEFAULT 'onboarding',
  -- enum: 'onboarding' | 'scheduled' | 'market_event' | 'module_complete' | 'user_request'
  market_context  jsonb       NULL,

  CONSTRAINT answers_valid CHECK (
    (answers->>'q1')::int BETWEEN 1 AND 5
    AND (answers->>'q2')::int BETWEEN 1 AND 5
    AND (answers->>'q3')::int BETWEEN 1 AND 5
    AND (answers->>'q4')::int BETWEEN 1 AND 3
    AND (answers->>'q5')::int BETWEEN 1 AND 5
    AND (answers->>'q6')::int BETWEEN 1 AND 5
    AND (answers->>'q7')::int BETWEEN 1 AND 5
  )
);

-- 인덱스
CREATE INDEX idx_bias_assessments_user_latest
  ON public.bias_assessments(user_id, diagnosed_at DESC);
CREATE INDEX idx_bias_flags_gin
  ON public.bias_assessments USING GIN(bias_flags);

-- RLS
ALTER TABLE public.bias_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own assessments"
  ON public.bias_assessments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role insert only"
  ON public.bias_assessments FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
