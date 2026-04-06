-- Migration 010: users 테이블에 push_token 컬럼 추가
-- Phase 3: FOMO 경보 Expo Push 알림 전용
-- Lock 3: push_token UPDATE는 RLS로 본인만 허용 (auth.uid() = id)

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS push_token TEXT;

-- fomo_alerts seen_at UPDATE — 본인 레코드만 허용 (Lock 3)
-- System-generated이지만 seen_at/dismissed_at은 클라이언트 anon UPDATE 허용
DROP POLICY IF EXISTS "fomo_alerts_seen_at_update" ON public.fomo_alerts;

CREATE POLICY "fomo_alerts_seen_at_update"
  ON public.fomo_alerts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 인덱스: push_token으로 빠른 조회 (EF 내부에서 user별 조회 시 사용)
CREATE INDEX IF NOT EXISTS idx_users_push_token
  ON public.users (push_token)
  WHERE push_token IS NOT NULL;
