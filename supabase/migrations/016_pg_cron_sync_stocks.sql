-- 016: pg_cron 종목 동기화 스케줄 (마스터플랜 0617 — Pillar 1)
-- 주 1회 sync-stocks EF 호출 → KRX 전종목을 stocks 테이블에 갱신.
--
-- 전제 조건:
--   - pg_cron, pg_net 확장 활성화 (009에서 이미 활성화)
--   - sync-stocks Edge Function 배포 완료 (`supabase functions deploy sync-stocks --no-verify-jwt`)
--   - KRX_API_KEY Secret 등록 (check-fomo와 공유)
--   - 011 마이그레이션(stocks 테이블) 선적용 필수

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 기존 동일 이름 job 제거 (idempotent)
SELECT cron.unschedule('weekly-stock-sync')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'weekly-stock-sync'
);

-- 매주 일요일 UTC 18:00 (KST 월요일 03:00) — 주중 거래 전 최신 종목 목록 확보
SELECT cron.schedule(
  'weekly-stock-sync',
  '0 18 * * 0',
  $$
  SELECT net.http_post(
    url := (
      SELECT decrypted_secret FROM vault.decrypted_secrets
      WHERE name = 'SUPABASE_URL' LIMIT 1
    ) || '/functions/v1/sync-stocks',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1
      ),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

DO $$
BEGIN
  RAISE NOTICE 'Stock sync cron registered: weekly Sun UTC 18:00 (KST Mon 03:00)';
END $$;
