-- 027_securitydefiner_execute_grants.sql
-- INVIT-DB-001 (advisor 0028/0029) 보강 — 026의 REVOKE FROM PUBLIC만으로는 부족.
-- Supabase 기본 설정이 anon/authenticated에 '명시적' EXECUTE를 부여하므로 해당 role을 직접 회수한다.
--
-- 정책:
--   handle_new_user        : 트리거 전용 → 누구도 RPC 호출 불가(트리거 실행은 grant 무관).
--   find_similar_principles : EF(service_role) 전용 → anon/authenticated 회수.
--   get_principles_by_archetype : 클라이언트 온보딩(AssessmentResultScreen, authenticated) + EF 사용 → authenticated 유지, anon만 회수.

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.find_similar_principles(public.vector, integer, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.find_similar_principles(public.vector, integer, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_principles_by_archetype(text, integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_principles_by_archetype(text, integer) TO authenticated, service_role;
