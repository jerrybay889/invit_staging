-- 005: fomo_alerts 테이블 (System-generated)
-- check-fomo EF 전용. Threshold LOCK v1.0.

CREATE TABLE IF NOT EXISTS public.fomo_alerts (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  alert_date      date        NOT NULL DEFAULT CURRENT_DATE,

  -- 경보 타입: MVP는 standard 2종만
  alert_type      text        NOT NULL,
  -- enum: 'surge_standard' | 'plunge_standard'

  -- 시장 데이터 스냅샷
  kospi_change_pct  numeric   NOT NULL,
  volume_change_pct numeric   NOT NULL,

  -- 경보 메시지 (LOCK 원문)
  message         text        NOT NULL,

  -- 사용자 반응 추적
  seen_at         timestamptz DEFAULT NULL,
  dismissed_at    timestamptz DEFAULT NULL,

  -- 쿨다운 관리
  direction       text        NOT NULL, -- 'surge' | 'plunge'
  cooldown_until  timestamptz NOT NULL,

  created_at      timestamptz DEFAULT now(),

  -- Idempotency: 같은 날 같은 방향 1회
  CONSTRAINT unique_fomo_per_day_direction UNIQUE (user_id, alert_date, direction)
);

CREATE INDEX idx_fomo_user_date
  ON public.fomo_alerts(user_id, alert_date DESC);

-- RLS
ALTER TABLE public.fomo_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own alerts"
  ON public.fomo_alerts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role insert only"
  ON public.fomo_alerts FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role update"
  ON public.fomo_alerts FOR UPDATE
  USING (auth.role() = 'service_role');
