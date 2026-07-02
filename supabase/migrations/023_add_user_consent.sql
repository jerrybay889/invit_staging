-- 023_add_user_consent.sql
-- PIPA 동의 메타데이터 + 계정 상태 컬럼 추가
-- G2: 개인정보 동의 감사 기록 (가입 시 수집)
-- G1: 계정 삭제 상태 추적

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS consent JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS status  TEXT  DEFAULT 'active'
    CHECK (status IN ('active', 'deleted'));

COMMENT ON COLUMN public.users.consent IS
  'PIPA 동의 감사 기록. 예: {"tos_at":"ISO8601","privacy_at":"ISO8601","privacy_version":"1.0","marketing":false}';

COMMENT ON COLUMN public.users.status IS
  '계정 상태. active(정상) | deleted(탈퇴 — PII 익명화됨)';

-- 기존 rows에 기본값 active 설정 (NULL 방지)
UPDATE public.users SET status = 'active' WHERE status IS NULL;
