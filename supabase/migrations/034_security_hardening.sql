-- Migration 034: 보안 하드닝 (코드리뷰 Immediate + Short-term)
-- AUTHZ-003: feature_flags 클라 노출을 whitelist 2종으로 축소
-- INFRA-001: Operational 테이블 anon/authenticated GRANT 회수
-- INFRA-002: 트리거 함수 search_path 고정
-- DATA-001: stock_master_recon.field_name NOT NULL 보장

-- ─── 1. feature_flags: authenticated 접근을 whitelist로 축소 (AUTHZ-003) ────────
-- 기존 정책: USING(true) → 전 플래그 노출 (coaching_ai·retrigger_assessment 포함)
-- 수정: fomo_alert·subscription만 (앱이 클라에서 직접 읽는 2종, Lock 2 필수)
-- 내부 플래그(coaching_ai, retrigger_assessment)는 EF 전용 → 클라이언트 차단
DROP POLICY IF EXISTS "Authenticated users can read feature flags" ON feature_flags;
CREATE POLICY feature_flags_client_select ON feature_flags
  FOR SELECT TO authenticated
  USING (key IN ('fomo_alert', 'subscription'));

-- anon은 정책 없으나 GRANT 잔존 → GraphQL 스키마 노출 방지를 위해 회수
REVOKE SELECT ON public.feature_flags FROM anon;

-- ─── 2. Operational 테이블 GRANT 회수 (INFRA-001) ─────────────────────────────
-- 현재: RLS-enabled + policy=0 → 행은 차단되나 GRANT 잔존
--   → GraphQL 스키마 노출 + 심층방어 부재 (analytics_events 패턴과 불일치)
REVOKE SELECT ON public.stock_master_recon FROM anon, authenticated;
REVOKE SELECT ON public.stock_sync_runs    FROM anon, authenticated;
REVOKE SELECT ON public.stock_change_log   FROM anon, authenticated;

-- etf_meta/etn_meta: 정책이 authenticated only이나 anon GRANT 잔존 → 정리
REVOKE SELECT ON public.etf_meta FROM anon;
REVOKE SELECT ON public.etn_meta FROM anon;

-- ─── 3. 트리거 함수 search_path 고정 (INFRA-002) ──────────────────────────────
-- proconfig=NULL → advisor 0011 WARN
-- get_principles_by_archetype는 이미 search_path="" 적용됨 → 동일 표준 적용
ALTER FUNCTION public.stocks_sync_recommendation_enabled() SET search_path = '';

-- ─── 4. stock_master_recon.field_name NOT NULL 보장 (DATA-001) ───────────────
-- UNIQUE(recon_date,code,field_name)에서 NULL은 서로 DISTINCT → idempotency 우회 가능
-- EF는 항상 field_name='listing_status'를 명시하므로 기존 NULL 행 없음(안전 UPDATE)
UPDATE public.stock_master_recon SET field_name = 'unknown' WHERE field_name IS NULL;
ALTER TABLE public.stock_master_recon
  ALTER COLUMN field_name SET DEFAULT 'unknown',
  ALTER COLUMN field_name SET NOT NULL;
