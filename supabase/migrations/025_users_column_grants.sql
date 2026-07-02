-- 025_users_column_grants.sql
-- AUTHZ-002 — users 컬럼 단위 쓰기 잠금 (Mythos 보안감사 Immediate A2)
--
-- 문제: RLS는 행(row)만 제한한다. "Users update own profile (limited)" 정책은
--   auth.uid()=id로 '본인 행'만 막을 뿐, 어떤 '컬럼'을 쓰는지는 막지 못한다.
--   그 결과 anon/authenticated가 자기 행의 discipline_score·current_streak·
--   coaching_archetype·bias_profile·is_premium·trial_* 까지 직접 UPDATE 가능 →
--   Lock 3(System-generated = service_role write 전용) 위반, 핵심 지표 조작 가능.
--
-- 해결: 컬럼 단위 GRANT로 클라이언트 UPDATE 가능 컬럼을 User-owned 필드로 한정.
--   - 클라이언트 실제 쓰기(2026-06 기준): push_token(notifications.ts), consent·status(S02_SignUp).
--   - display_name은 User-owned 프로필 필드라 함께 허용(설정/프로필 편집 대비).
--   - service_role은 컬럼 GRANT/RLS를 우회 → calculate-discipline 등 EF 갱신은 영향 없음.
--   - anon은 RLS(auth.uid()=id)상 어차피 0행이지만 명시적으로 UPDATE 전면 회수.
--
-- 검증: authenticated로 discipline_score PATCH → 403(permission denied for column),
--       display_name/push_token/consent/status PATCH → 정상, service_role 전체 갱신 → 정상.

-- 1) 전체 컬럼 UPDATE 회수
REVOKE UPDATE ON public.users FROM anon;
REVOKE UPDATE ON public.users FROM authenticated;

-- 2) User-owned 컬럼만 재부여 (authenticated 전용)
GRANT UPDATE (display_name, push_token, consent, status) ON public.users TO authenticated;

-- 참고: authenticated용 INSERT 정책이 없어 신규행 INSERT는 RLS로 이미 차단되며
--       프로필 행은 트리거 handle_new_user가 생성한다. 본 마이그레이션은 UPDATE 권한만 조정한다.
