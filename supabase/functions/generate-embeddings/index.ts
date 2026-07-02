/**
 * generate-embeddings — principles_master 임베딩 배치 생성
 * Pillar 2: 글로벌 원칙 마스터 DB pgvector RAG 기반 (Phase 1)
 *
 * 인증: service_role JWT (pg_cron 또는 관리자 수동 호출)
 * 전제: OPENAI_API_KEY Secret 등록 필요
 * 호출: POST /functions/v1/generate-embeddings
 *   body: { batch_size?: number }  (기본 50)
 *
 * 동작:
 *   1. principles_master에서 embedding IS NULL인 행 배치 조회
 *   2. OpenAI text-embedding-3-small (1536d) 호출
 *   3. embedding, embedding_model, embedded_at 업데이트
 *   4. 남은 행이 있으면 count 반환 (외부에서 반복 호출)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const OPENAI_EMBED_URL = 'https://api.openai.com/v1/embeddings';
// Lock 5 — 비용 계측/가드. text-embedding-3-small = $0.02 / 1M tokens.
const EMBED_USD_PER_MTOK = 0.02;
const COST_BLOCK_THRESHOLD_USD = 10.0;

function isServiceRoleJwt(authHeader: string): boolean {
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json);
    return payload?.role === 'service_role';
  } catch { return false; }
}

// Lock 5 — 당월 전체 AI 비용 합계 (ai_call_logs 집계)
async function getMonthlyAICost(supabase: ReturnType<typeof createClient>): Promise<number> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from('ai_call_logs')
    .select('estimated_cost_usd')
    .gte('created_at', monthStart.toISOString());
  if (error || !data) return 0;
  return data.reduce((sum, r) => sum + Number(r.estimated_cost_usd), 0);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!isServiceRoleJwt(authHeader)) {
    return new Response(JSON.stringify({ error: 'Forbidden — service_role only' }), { status: 403 });
  }

  if (!OPENAI_API_KEY) {
    return new Response(JSON.stringify({
      error: 'OPENAI_API_KEY not configured',
      hint: 'Register OPENAI_API_KEY in Supabase Secrets to enable pgvector RAG',
    }), { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const batchSize = Math.min(Number(body.batch_size ?? 50), 100);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 임베딩 미생성 행 배치 조회
  const { data: rows, error: fetchErr } = await supabase
    .from('principles_master')
    .select('id, content, author, tags')
    .is('embedding', null)
    .eq('is_active', true)
    .limit(batchSize);

  if (fetchErr) {
    return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500 });
  }

  if (!rows || rows.length === 0) {
    return new Response(JSON.stringify({ success: true, processed: 0, message: 'All principles already embedded' }));
  }

  // 원칙 텍스트 구성 (원저자 + 내용만 포함 — PII 없음)
  const inputs = rows.map((r) =>
    `[${r.author ?? 'Unknown'}] ${r.content}${r.tags?.length ? ` [${r.tags.join(', ')}]` : ''}`
  );

  // Lock 5 — 비용 가드: 당월 누적 비용 초과 시 차단
  const monthlyCost = await getMonthlyAICost(supabase);
  if (monthlyCost >= COST_BLOCK_THRESHOLD_USD) {
    return new Response(JSON.stringify({
      error: 'Monthly AI cost cap reached', monthly_cost_usd: monthlyCost,
    }), { status: 503 });
  }

  // OpenAI embeddings 호출
  const embedRes = await fetch(OPENAI_EMBED_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: inputs, dimensions: EMBEDDING_DIMENSIONS }),
  });

  if (!embedRes.ok) {
    const errText = await embedRes.text();
    return new Response(JSON.stringify({ error: `OpenAI error: ${embedRes.status}`, detail: errText }), { status: 502 });
  }

  const embedJson = await embedRes.json();
  const embeddings: number[][] = embedJson.data.map((d: { embedding: number[] }) => d.embedding);

  // Lock 5 — 비용 로깅 (생략 불가)
  const totalTokens = Number(embedJson.usage?.total_tokens ?? 0);
  try {
    await supabase.from('ai_call_logs').insert({
      user_id: null,
      function_name: 'generate-embeddings',
      model: EMBEDDING_MODEL,
      input_tokens: totalTokens,
      output_tokens: 0,
      estimated_cost_usd: (totalTokens / 1_000_000) * EMBED_USD_PER_MTOK,
    });
  } catch (e) {
    console.error('ai_call_logs insert failed:', e);
  }

  // 개별 업데이트 (upsert 미사용 — embedding_model + embedded_at 동시 업데이트)
  const now = new Date().toISOString();
  const updates = rows.map((r, i) =>
    supabase.from('principles_master').update({
      embedding: `[${embeddings[i].join(',')}]`,
      embedding_model: EMBEDDING_MODEL,
      embedded_at: now,
    }).eq('id', r.id)
  );
  await Promise.all(updates);

  // 남은 미처리 행 수 집계
  const { count: remaining } = await supabase
    .from('principles_master')
    .select('id', { count: 'exact', head: true })
    .is('embedding', null)
    .eq('is_active', true);

  return new Response(JSON.stringify({
    success: true,
    processed: rows.length,
    remaining: remaining ?? 0,
    model: EMBEDDING_MODEL,
  }));
});
