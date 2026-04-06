-- 009: pg_cron FOMO 자동 체크 스케줄
-- 매일 장 마감 후 (KST 16:00 = UTC 07:00) check-fomo EF를 모든 사용자 대상으로 실행
--
-- 전제 조건:
--   - pg_cron 확장이 Supabase 대시보드에서 활성화되어 있어야 함
--   - pg_net 확장이 활성화되어 있어야 함 (HTTP 호출)
--   - Supabase Edge Function 'check-fomo' 배포 완료
--
-- 운영:
--   - feature_flags.fomo_alert = true 로 전환 후 실제 경보 발동 (Lock 2)
--   - 장 휴일(공휴일)에는 KOSPI API가 빈 데이터를 반환 → triggered: false 정상 처리됨

-- pg_cron, pg_net 확장 활성화 (이미 활성화된 경우 무시)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 기존 동일 이름 cron job 제거 (idempotent 재실행 보장)
SELECT cron.unschedule('daily-fomo-check')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'daily-fomo-check'
);

-- 매일 KST 16:00 (UTC 07:00) FOMO 체크 스케줄 등록
-- 모든 사용자에 대해 순차적으로 check-fomo EF 호출
-- 주의: 사용자가 많아지면 별도의 batch 처리 EF로 분리 필요 (Phase 2)
SELECT cron.schedule(
  'daily-fomo-check',
  '0 7 * * 1-5',  -- 평일(월~금)만 실행 (주말 휴장)
  $$
  SELECT
    net.http_post(
      url := (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'SUPABASE_URL'
        LIMIT 1
      ) || '/functions/v1/check-fomo',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
          LIMIT 1
        ),
        'Content-Type', 'application/json',
        'x-fomo-source', 'pg_cron'
      ),
      body := jsonb_build_object('user_id', u.id::text)
    )
  FROM public.users u
  WHERE u.created_at IS NOT NULL
  LIMIT 1000;  -- 초기 MVP: 최대 1000명 제한
  $$
);

-- 스케줄 등록 확인 (로그용)
DO $$
BEGIN
  RAISE NOTICE 'FOMO check cron job registered: daily at KST 16:00 (UTC 07:00), weekdays only';
END $$;
