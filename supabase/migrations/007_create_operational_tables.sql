-- 007: Operational 테이블 (클라이언트 접근 전면 차단)

-- ai_call_logs — OpenAI API 비용 추적 (Lock 5 가드레일)
CREATE TABLE IF NOT EXISTS public.ai_call_logs (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  function_name     text        NOT NULL,
  model             text        NOT NULL DEFAULT 'none',
  input_tokens      int         NOT NULL DEFAULT 0,
  output_tokens     int         NOT NULL DEFAULT 0,
  estimated_cost_usd numeric(8,6) NOT NULL DEFAULT 0,
  masked_input      text,
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX idx_ai_logs_monthly_cost
  ON public.ai_call_logs(created_at, estimated_cost_usd);

ALTER TABLE public.ai_call_logs ENABLE ROW LEVEL SECURITY;

-- 클라이언트 접근 완전 차단
CREATE POLICY "Service role only"
  ON public.ai_call_logs FOR ALL
  USING (auth.role() = 'service_role');

-- error_logs — 에러 추적
CREATE TABLE IF NOT EXISTS public.error_logs (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  type            text        NOT NULL,
  -- enum: 'validation_error' | 'legal_filter_violation' | 'rate_limit' | 'edge_function_error' | 'unknown'
  message         text        NOT NULL,
  stack           text,
  metadata        jsonb       DEFAULT '{}',
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only"
  ON public.error_logs FOR ALL
  USING (auth.role() = 'service_role');

-- feature_flags — 기능 플래그 (Lock 2)
CREATE TABLE IF NOT EXISTS public.feature_flags (
  key             text        PRIMARY KEY,
  enabled         boolean     DEFAULT false,
  description     text,
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only"
  ON public.feature_flags FOR ALL
  USING (auth.role() = 'service_role');

-- 초기 Feature Flags 삽입 (모두 OFF)
-- CLAUDE.md Lock 2 준거: 아래 4종은 Jerry 서면 승인 후 수동 ON만 허용.
-- 배포 시 자동 활성화 절대 금지.
INSERT INTO public.feature_flags (key, enabled, description) VALUES
  ('coaching_ai', false, 'AI 코칭 문구 생성 활성화'),
  ('fomo_alert', false, 'FOMO 경보 시스템 활성화'),
  ('subscription', false, 'RevenueCat 구독 결제 활성화'),
  ('retrigger_assessment', false, '편향 재진단 트리거 활성화')
ON CONFLICT (key) DO NOTHING;
