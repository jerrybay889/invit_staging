-- 026_db_hardening.sql
-- INVIT-DB-001 + HARDENING-001 (Mythos 보안감사 Short-term S4)
-- Supabase advisor 0011(search_path mutable) / 0026·0027(anon·authenticated 노출) / 0028·0029(SECURITY DEFINER 실행) 대응.
--
-- 주의: 클라이언트 의존성 검증 후 작성.
--   - get_principles_by_archetype: 클라이언트(AssessmentResultScreen) + generate-coaching(service_role)가 호출 → authenticated EXECUTE 유지.
--   - find_similar_principles: 클라이언트 미사용(임베딩 RAG는 EF 전용) → service_role만.
--   - feature_flags: 클라이언트(useSubscription/useFomoAlert)가 SELECT → 권한 회수 제외(별도 설계 이슈로 분리).
--   - ai_call_logs/error_logs/content_sources: 클라이언트 미사용 → SELECT 회수.

-- 1) SECURITY DEFINER 함수 search_path 고정 (search_path 하이재킹 차단)
--    handle_new_user·get_principles_by_archetype: 모든 참조가 public.* 정규화돼 있어 '' 안전.
--    find_similar_principles: pgvector '<=>' 연산자(public)가 필요해 public 고정.
ALTER FUNCTION public.handle_new_user() SET search_path = '';
ALTER FUNCTION public.get_principles_by_archetype(text, integer) SET search_path = '';
ALTER FUNCTION public.find_similar_principles(public.vector, integer, text) SET search_path = public;

-- 2) SECURITY DEFINER 함수 EXECUTE 최소화 (PUBLIC=anon 포함 회수 후 필요한 role만 재부여)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;  -- 트리거 전용, RPC 노출 불필요

REVOKE EXECUTE ON FUNCTION public.find_similar_principles(public.vector, integer, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.find_similar_principles(public.vector, integer, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_principles_by_archetype(text, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_principles_by_archetype(text, integer) TO authenticated, service_role;

-- 3) Operational 계층 테이블의 anon/authenticated SELECT 회수 (RLS가 이미 0행이나 스키마 노출 제거)
REVOKE SELECT ON public.ai_call_logs  FROM anon, authenticated;
REVOKE SELECT ON public.error_logs    FROM anon, authenticated;
REVOKE SELECT ON public.content_sources FROM anon, authenticated;
