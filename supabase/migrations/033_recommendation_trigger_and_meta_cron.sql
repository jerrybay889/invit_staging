-- Migration 033: recommendation_enabled 트리거 대칭화 + sync-stocks-meta pg_cron
-- 코드리뷰 #6 수정: 비ACTIVE→ACTIVE 전환 시 recommendation_enabled 복원 누락 보완

-- ─── 1. recommendation_enabled 트리거 대칭화 ──────────────────────────────────
-- 기존(031): 비정상 상태 진입 시 false만 설정, 복원 시 그대로 false 유지
-- 수정: 비ACTIVE→ACTIVE 전환 시 true로 재설정 (ACTIVE→ACTIVE 유지 시는 불변)
CREATE OR REPLACE FUNCTION stocks_sync_recommendation_enabled()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.listing_status IN ('ADMINISTRATIVE','HALTED','DELISTING_PENDING','DELISTED','MATURED') THEN
    NEW.recommendation_enabled := false;
  ELSIF NEW.listing_status = 'ACTIVE'
    AND (OLD.listing_status IS DISTINCT FROM 'ACTIVE') THEN
    -- 비ACTIVE → ACTIVE 상태 전환 시에만 복원 (수동 비활성 종목 보호)
    NEW.recommendation_enabled := true;
  END IF;
  RETURN NEW;
END;
$$;

-- 트리거 재등록 (함수만 교체해도 되지만 명시적 재등록으로 의도 명확화)
DROP TRIGGER IF EXISTS trg_stocks_recommendation_enabled ON stocks;
CREATE TRIGGER trg_stocks_recommendation_enabled
  BEFORE INSERT OR UPDATE OF listing_status ON stocks
  FOR EACH ROW EXECUTE FUNCTION stocks_sync_recommendation_enabled();

-- ─── 2. sync-stocks-meta 일배치 pg_cron ──────────────────────────────────────
-- 평일 18:00 KST (09:00 UTC) 실행 — 장 마감(15:30 KST) 후 상태 보강
-- KIS_APP_KEY/KIS_APP_SECRET 미설정 시 SKIPPED 반환하므로 등록 자체는 무해
SELECT cron.schedule(
  'daily-stock-meta-sync',
  '0 9 * * 1-5',
  $$
    SELECT net.http_post(
      url     := (SELECT decrypted_secret FROM vault.decrypted_secrets
                  WHERE name = 'SUPABASE_URL' LIMIT 1)
                  || '/functions/v1/sync-stocks-meta',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1
        ),
        'Content-Type', 'application/json'
      ),
      body    := '{}'::jsonb
    );
  $$
);
