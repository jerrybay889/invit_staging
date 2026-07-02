-- Migration 035: B2 recommendation_override + B5 cron 헬스 워치독
-- LOGIC-001: 수동 억제(recommendation_override) 내구화 — 라운드트립 후 소실 방지
-- OPS-001:   cron 실패 무알림 해소 — error_logs 적재 + 헬스 리포트 함수

-- ─── B2: recommendation_override 컬럼 (LOGIC-001) ────────────────────────────
-- NULL  = 자동관리 (현행 동작 유지)
-- false = 수동 억제: ACTIVE 복원 시 트리거가 true로 덮어쓰지 않음
--                    HALTED 등 악화 시에도 자동 false는 여전히 동작
ALTER TABLE public.stocks
  ADD COLUMN IF NOT EXISTS recommendation_override boolean;

-- 트리거 업데이트: recommendation_override = false 이면 자동 복원 건너뜀
-- (INFRA-002 fix-auth: SET search_path = '' 유지)
CREATE OR REPLACE FUNCTION public.stocks_sync_recommendation_enabled()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF NEW.listing_status IN (
      'ADMINISTRATIVE','HALTED','DELISTING_PENDING','DELISTED','MATURED'
  ) THEN
    -- 상태 악화 → 항상 비활성화 (수동 override 무시: 안전 우선)
    NEW.recommendation_enabled := false;
  ELSIF NEW.listing_status = 'ACTIVE'
    AND (OLD.listing_status IS DISTINCT FROM 'ACTIVE')
    AND NEW.recommendation_override IS NULL THEN
    -- 비ACTIVE → ACTIVE + 수동 억제 없는 경우만 자동 복원
    -- recommendation_override IS NOT NULL(false) 이면 이 분기 건너뜀 → 수동 결정 유지
    NEW.recommendation_enabled := true;
  END IF;
  RETURN NEW;
END;
$$;

-- 수동 억제 운영법 (주석):
-- 억제: UPDATE stocks SET recommendation_override=false, recommendation_enabled=false WHERE code='...';
-- 해제: UPDATE stocks SET recommendation_override=NULL WHERE code='...';
--       → 다음 비ACTIVE→ACTIVE 전환 시 트리거가 자동 복원

-- ─── B5: cron 헬스 리포트 함수 (OPS-001) ────────────────────────────────────
-- Jerry/서비스롤이 직접 조회: SELECT * FROM public.cron_health_check();
CREATE OR REPLACE FUNCTION public.cron_health_check()
RETURNS TABLE (
  job_name        text,
  last_run_at     timestamptz,
  last_status     text,
  hours_since_run numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    j.jobname::text,
    d.start_time,
    d.status::text,
    ROUND(EXTRACT(EPOCH FROM (now() - d.start_time)) / 3600, 1)
  FROM cron.job j
  LEFT JOIN LATERAL (
    SELECT status, start_time
    FROM cron.job_run_details
    WHERE jobid = j.jobid
    ORDER BY start_time DESC
    LIMIT 1
  ) d ON true
  WHERE j.jobname IN (
    'daily-stock-meta-sync',
    'daily-fomo-check',
    'weekly-stock-sync',
    'cron-health-watchdog'
  )
  ORDER BY j.jobname;
$$;

REVOKE ALL ON FUNCTION public.cron_health_check() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cron_health_check() TO service_role;

-- ─── B5: 워치독 함수 — 미성공 cron 감지 → error_logs 기록 ──────────────────
-- 일배치(26h 창): daily-stock-meta-sync, daily-fomo-check
-- 주배치(8d 창): weekly-stock-sync
-- 참고: SECURITY DEFINER로 postgres 소유 → pg_cron 실행 컨텍스트에서 RLS 우회
CREATE OR REPLACE FUNCTION public.check_cron_health()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_jobname  text;
  v_last_ok  timestamptz;
BEGIN
  -- 일배치 감시: 26시간 내 성공 없으면 경보
  FOREACH v_jobname IN ARRAY ARRAY['daily-stock-meta-sync','daily-fomo-check'] LOOP
    SELECT MAX(d.start_time) INTO v_last_ok
    FROM cron.job j
    JOIN cron.job_run_details d ON d.jobid = j.jobid
    WHERE j.jobname = v_jobname
      AND d.status   = 'succeeded'
      AND d.start_time > now() - interval '26 hours';

    IF v_last_ok IS NULL THEN
      INSERT INTO public.error_logs (type, message, metadata, created_at)
      VALUES (
        'cron_health_failure',
        format('cron "%s" no successful run in last 26 hours (checked %s)', v_jobname, now()),
        jsonb_build_object('job_name', v_jobname, 'window_hours', 26),
        now()
      );
    END IF;
  END LOOP;

  -- 주배치 감시: 8일 내 성공 없으면 경보
  v_jobname := 'weekly-stock-sync';
  SELECT MAX(d.start_time) INTO v_last_ok
  FROM cron.job j
  JOIN cron.job_run_details d ON d.jobid = j.jobid
  WHERE j.jobname = v_jobname
    AND d.status   = 'succeeded'
    AND d.start_time > now() - interval '8 days';

  IF v_last_ok IS NULL THEN
    INSERT INTO public.error_logs (type, message, metadata, created_at)
    VALUES (
      'cron_health_failure',
      format('cron "%s" no successful run in last 8 days (checked %s)', v_jobname, now()),
      jsonb_build_object('job_name', v_jobname, 'window_hours', 192),
      now()
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.check_cron_health() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_cron_health() TO service_role;

-- 워치독 스케줄: 평일 10:00 UTC (19:00 KST)
-- daily-stock-meta-sync(09:00 UTC) 완료 1시간 후 체크 — 불필요 경보 최소화
SELECT cron.schedule(
  'cron-health-watchdog',
  '0 10 * * 1-5',
  $$ SELECT public.check_cron_health(); $$
);
