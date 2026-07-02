-- 012: principles_master — 글로벌 투자원칙 마스터 DB (Admin-managed)
-- 마스터플랜 0617 — Pillar 2. 유저 소유 principles 테이블과 분리.
-- 클라이언트 SELECT 전용. 쓰기는 service_role / 편집팀 전용(정책 미작성으로 차단).
-- 주의: pgvector embedding 컬럼은 Phase 1에서 별도 마이그레이션으로 추가 (extension 의존성 분리).

CREATE TABLE IF NOT EXISTS public.principles_master (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  title             text        NOT NULL,                 -- 원칙 한 줄 제목 (KR)
  title_en          text,
  body_text         text        NOT NULL,                 -- 원칙 본문 (교육적 서술)
  source_author     text        NOT NULL,                 -- 출처 대가명 (KR)
  source_author_en  text,
  source_ref        text,                                 -- 원문 출처 (저서/인터뷰/URL)

  -- 출처 Tier: 'global'(글로벌 대가) | 'kr'(한국 대가) | 'invit'(독자 원칙)
  source_tier       text        NOT NULL DEFAULT 'global',

  -- 4축 분류 태그 (JSONB 배열)
  bias_tags         jsonb       DEFAULT '[]'::jsonb,       -- 편향유형
  market_phase_tags jsonb       DEFAULT '[]'::jsonb,       -- 시장국면
  behavior_tags     jsonb       DEFAULT '[]'::jsonb,       -- 매매행동
  style_tags        jsonb       DEFAULT '[]'::jsonb,       -- 투자스타일

  tier              smallint    DEFAULT 1,                 -- 큐레이션 우선순위 1~4
  is_verified       boolean     DEFAULT true,
  is_active         boolean     DEFAULT true,
  usage_count       integer     DEFAULT 0,
  user_save_count   integer     DEFAULT 0,

  created_at        timestamptz DEFAULT now(),
  last_reviewed_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_principles_master_active ON public.principles_master(is_active);
CREATE INDEX IF NOT EXISTS idx_principles_master_author ON public.principles_master(source_author);
CREATE INDEX IF NOT EXISTS idx_principles_master_tier   ON public.principles_master(source_tier);
CREATE INDEX IF NOT EXISTS idx_principles_master_bias   ON public.principles_master USING GIN (bias_tags);

ALTER TABLE public.principles_master ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active master principles"
  ON public.principles_master FOR SELECT
  USING (is_active = true);
