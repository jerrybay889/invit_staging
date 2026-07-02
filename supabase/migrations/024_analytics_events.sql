-- 024_analytics_events.sql
-- 런칭 코호트 계측용 이벤트 테이블
-- G4: 첫 코호트 퍼널 데이터 확보 (onboarding → journal → coaching → paywall)
-- Operational 계층 — 클라이언트 접근 전면 차단, service_role(log-events EF) 전용

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  event_name  TEXT NOT NULL,
  props       JSONB DEFAULT '{}',
  client_ts   TIMESTAMPTZ,           -- 클라이언트 발생 시각 (지연·오프라인 대비)
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
-- 정책 없음 = service_role 전용 (클라이언트 완전 차단)

CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id
  ON public.analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name
  ON public.analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at
  ON public.analytics_events(created_at DESC);

COMMENT ON TABLE public.analytics_events IS
  'Operational — service_role(log-events EF) 전용. PII 금지. 클라이언트 접근 차단.';
