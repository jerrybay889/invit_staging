-- 006: coaching_cards + principles 테이블

-- coaching_cards (System-generated)
-- generate-coaching EF 전용. MVP에서는 아키타입별 템플릿 DB 조회.
CREATE TABLE IF NOT EXISTS public.coaching_cards (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  card_date       date        NOT NULL DEFAULT CURRENT_DATE,

  archetype       text        NOT NULL,
  content         text        NOT NULL,
  source          text        NOT NULL DEFAULT 'template',
  -- enum: 'template' | 'ai_generated'

  created_at      timestamptz DEFAULT now(),

  -- Idempotency: 1일 1코칭
  CONSTRAINT unique_coaching_per_day UNIQUE (user_id, card_date)
);

ALTER TABLE public.coaching_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own coaching"
  ON public.coaching_cards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role insert"
  ON public.coaching_cards FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role update"
  ON public.coaching_cards FOR UPDATE
  USING (auth.role() = 'service_role');

-- principles (User-owned)
-- 투자 원칙 목록. discipline score 40% 기여.
CREATE TABLE IF NOT EXISTS public.principles (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content         text        NOT NULL,
  is_active       boolean     DEFAULT true,
  sort_order      smallint    DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_principles_user
  ON public.principles(user_id, sort_order);

ALTER TABLE public.principles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own principles"
  ON public.principles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own principles"
  ON public.principles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own principles"
  ON public.principles FOR UPDATE
  USING (auth.uid() = user_id);

-- archetype_templates (Admin-managed)
-- 아키타입별 코칭 메시지 템플릿. MVP에서 RAG 대체.
CREATE TABLE IF NOT EXISTS public.archetype_templates (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  archetype       text        NOT NULL,
  category        text        NOT NULL DEFAULT 'daily_nudge',
  -- enum: 'daily_nudge' | 'fomo_response' | 'principle_reminder'
  content         text        NOT NULL,
  is_active       boolean     DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_archetype_templates_lookup
  ON public.archetype_templates(archetype, category, is_active);

ALTER TABLE public.archetype_templates ENABLE ROW LEVEL SECURITY;

-- 클라이언트 읽기만 허용 (코칭 카드 표시용)
CREATE POLICY "Anyone can read active templates"
  ON public.archetype_templates FOR SELECT
  USING (is_active = true);
