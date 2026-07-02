-- 017: pgvector 확장 + principles_master 임베딩 컬럼
-- 마스터플랜 0617 Pillar 2 — 글로벌 원칙 마스터 DB RAG 기반 (Phase 1)
--
-- 전제 조건:
--   - 012_create_principles_master.sql 선적용 (principles_master 테이블 존재)
--   - Supabase 프로젝트에서 pgvector 확장 지원 확인 (Free Tier 포함 지원)
--
-- 임베딩 생성은 별도 파이프라인(Edge Function 또는 n8n)에서 수행.
-- 이 마이그레이션은 컬럼과 인덱스 구조만 준비한다.

-- 1. pgvector 확장 활성화 (이미 활성화된 경우 무해)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. principles_master에 embedding 컬럼 추가 (text-embedding-3-small = 1536 dimensions)
ALTER TABLE public.principles_master
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- 3. HNSW 인덱스 — 코사인 유사도 검색 최적화 (RAG 시맨틱 검색용)
--    embedding IS NOT NULL 조건 필터링으로 미생성 행 제외
CREATE INDEX IF NOT EXISTS principles_master_embedding_hnsw
  ON public.principles_master
  USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;

-- 4. embedding_model 메타 컬럼 (어떤 모델로 생성됐는지 추적)
ALTER TABLE public.principles_master
  ADD COLUMN IF NOT EXISTS embedding_model TEXT DEFAULT NULL;

ALTER TABLE public.principles_master
  ADD COLUMN IF NOT EXISTS embedded_at TIMESTAMPTZ DEFAULT NULL;

DO $$
BEGIN
  RAISE NOTICE 'pgvector enabled. principles_master.embedding (1536d) + HNSW index ready.';
  RAISE NOTICE 'Next: run embedding pipeline to populate embedding column.';
END $$;
