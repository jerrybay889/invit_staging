-- 001: users 테이블 (User-owned)
-- INVIT 사용자 프로필. auth.users 확장.

CREATE TABLE IF NOT EXISTS public.users (
  id              uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name    text,

  -- 편향 진단 결과 (submit-bias-assessment EF가 갱신)
  bias_profile    jsonb       DEFAULT NULL,
  coaching_archetype text     DEFAULT NULL,

  -- 규율 점수 (calculate-discipline EF가 갱신)
  discipline_score smallint   DEFAULT 0,
  current_streak   smallint   DEFAULT 0,

  -- Reverse Trial
  trial_started_at  timestamptz DEFAULT now(),
  trial_ends_at     timestamptz DEFAULT (now() + interval '14 days'),
  is_premium        boolean    DEFAULT false,

  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users update own profile (limited)"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- service_role이 bias_profile, coaching_archetype, discipline_score 갱신
CREATE POLICY "Service role full access"
  ON public.users FOR ALL
  USING (auth.role() = 'service_role');

-- 신규 가입 시 자동 프로필 생성 트리거
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id)
  VALUES (new.id);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
