-- 018: pgvector RAG — 원칙 유사도 검색 SQL 함수
-- 마스터플랜 0617 Pillar 2 (Phase 1 — generate-embeddings EF + OPENAI_API_KEY 등록 후 활성)
--
-- 사용:
--   SELECT * FROM find_similar_principles(embedding_vector, match_count, filter_archetype);
-- 호출처:
--   generate-coaching EF — 유저 일지 임베딩 → 유사 원칙 Top-K 조회 → Claude 컨텍스트 주입

-- 전제: 017 마이그레이션(vector 확장, embedding 컬럼) 적용 완료

CREATE OR REPLACE FUNCTION public.find_similar_principles(
  query_embedding    vector(1536),
  match_count        int     DEFAULT 5,
  filter_archetype   text    DEFAULT NULL  -- NULL이면 아키타입 필터 없이 전체 검색
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
SECURITY DEFINER  -- RLS 우회: 글로벌 원칙은 공개 읽기 허용(012 마이그레이션 정책 준수)
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pm.id,
    pm.content,
    pm.author,
    pm.source_tier,
    pm.tags,
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

-- 함수 코멘트
COMMENT ON FUNCTION public.find_similar_principles IS
  'pgvector 코사인 유사도로 principles_master에서 Top-K 원칙 검색. generate-coaching EF에서 RAG 컨텍스트 구성에 사용.';

DO $$
BEGIN
  RAISE NOTICE 'find_similar_principles() function created. Ready for RAG after embeddings are generated.';
END $$;
