-- 013: daily_briefings + content_sources — 일일 시황 브리핑 파이프라인
-- 마스터플랜 0617 — Pillar 3. 외부 독립 파이프라인(Gemini 노코드)이 INSERT, 앱은 SELECT만.

-- ── daily_briefings (System/Operational — 외부 파이프라인 생성) ──
CREATE TABLE IF NOT EXISTS public.daily_briefings (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  briefing_date   date        NOT NULL DEFAULT CURRENT_DATE,

  source_channel  text,                       -- 예: '12시에 만나요'
  source_url      text,
  source_title    text,

  brief_title     text        NOT NULL,        -- 오늘 시황 한 줄 제목
  summary         text        NOT NULL,        -- 핵심 시황 요약
  key_sectors     jsonb       DEFAULT '[]'::jsonb,
  risk_signals    text,                        -- 오늘 주의 리스크
  principle_hint  text,                        -- 오늘 시황에 어울리는 원칙 한 문장
  bias_warning    text,                        -- 오늘 빠지기 쉬운 편향
  linked_principle_id uuid    REFERENCES public.principles_master(id),

  auto_approved   boolean     DEFAULT false,
  published_at    timestamptz DEFAULT now(),
  created_at      timestamptz DEFAULT now(),

  -- 하루/소스당 1건 (Idempotency)
  CONSTRAINT unique_briefing_per_day_source UNIQUE (briefing_date, source_channel)
);

CREATE INDEX IF NOT EXISTS idx_briefings_date ON public.daily_briefings(briefing_date DESC);

ALTER TABLE public.daily_briefings ENABLE ROW LEVEL SECURITY;

-- 발행된 브리핑은 모든 로그인 사용자 읽기 가능 (공유 콘텐츠). 쓰기는 service_role 전용.
CREATE POLICY "Anyone can read published briefings"
  ON public.daily_briefings FOR SELECT
  USING (published_at IS NOT NULL);

-- ── content_sources (Operational — 클라이언트 전면 차단) ──
CREATE TABLE IF NOT EXISTS public.content_sources (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  name              text        NOT NULL,
  type              text        NOT NULL DEFAULT 'youtube_channel', -- youtube_channel|news_site|web_link
  url               text,
  channel_id        text,
  trigger_schedule  text,                     -- cron 표현식 (예: 매 1분, 11:45~14:00)
  priority_level    smallint    DEFAULT 1,
  auto_publish      boolean     DEFAULT false,
  is_active         boolean     DEFAULT true,
  last_crawled_at   timestamptz,
  last_success_at   timestamptz,
  created_at        timestamptz DEFAULT now()
);

-- Operational 계층: 클라이언트 접근 전면 차단 (RLS 활성 + 정책 미작성 → service_role만).
ALTER TABLE public.content_sources ENABLE ROW LEVEL SECURITY;
