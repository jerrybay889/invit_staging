-- 앱(authenticated)이 feature_flags를 읽을 수 있도록 SELECT 정책 추가.
-- CLAUDE.md Lock 2: 쓰기는 service_role 전용(기존 정책 유지), 읽기만 허용.
CREATE POLICY "Authenticated users can read feature flags"
ON public.feature_flags
FOR SELECT
TO authenticated
USING (true);
