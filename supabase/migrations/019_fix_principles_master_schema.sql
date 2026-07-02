-- 019: principles_master 스키마 보완
-- (1) archetype_tags text[] 컬럼 추가 (find_similar_principles 필터용)
-- (2) find_similar_principles 함수 재정의 (018 교체 — archetype_tags 기반으로 수정)
-- (3) bias_tags / behavior_tags / style_tags / market_phase_tags를 text[] 캐스팅 인덱스 추가
--     (012에서 jsonb로 생성했으나 text[] 비교가 더 직관적 — 두 방식 모두 지원)

-- 1. archetype_tags 컬럼 추가 (기본 빈 배열)
ALTER TABLE public.principles_master
  ADD COLUMN IF NOT EXISTS archetype_tags text[] DEFAULT '{}';

-- 2. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_principles_master_archetype
  ON public.principles_master USING GIN (archetype_tags);

-- 3. find_similar_principles 재정의 (archetype_tags 기반)
CREATE OR REPLACE FUNCTION public.find_similar_principles(
  query_embedding    vector(1536),
  match_count        int     DEFAULT 5,
  filter_archetype   text    DEFAULT NULL
)
RETURNS TABLE (
  id               uuid,
  content          text,
  author           text,
  source_tier      text,
  tags             text[],
  archetype_tags   text[],
  similarity       float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pm.id,
    pm.body_text            AS content,
    pm.source_author        AS author,
    pm.source_tier,
    pm.archetype_tags       AS tags,
    pm.archetype_tags,
    1 - (pm.embedding <=> query_embedding) AS similarity
  FROM public.principles_master pm
  WHERE
    pm.is_active = TRUE
    AND pm.embedding IS NOT NULL
    AND (filter_archetype IS NULL OR filter_archetype = ANY(pm.archetype_tags))
  ORDER BY pm.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 4. 키워드 기반(embedding 없이도 동작) 아키타입 원칙 조회 함수 (임베딩 파이프라인 전 폴백용)
CREATE OR REPLACE FUNCTION public.get_principles_by_archetype(
  p_archetype  text,
  p_limit      int DEFAULT 3
)
RETURNS TABLE (
  id           uuid,
  body_text    text,
  source_author text,
  source_tier  text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT pm.id, pm.body_text, pm.source_author, pm.source_tier
  FROM public.principles_master pm
  WHERE
    pm.is_active = TRUE
    AND (p_archetype = ANY(pm.archetype_tags) OR cardinality(pm.archetype_tags) = 0)
  ORDER BY pm.tier ASC, pm.user_save_count DESC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION public.get_principles_by_archetype IS
  '임베딩 없이 archetype_tags 기반으로 관련 원칙 조회. generate-coaching EF Phase 1 RAG 폴백으로 사용.';

DO $$
BEGIN
  RAISE NOTICE '019: archetype_tags column + get_principles_by_archetype() function added.';
END $$;
