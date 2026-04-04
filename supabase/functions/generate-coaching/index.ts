/**
 * generate-coaching Edge Function
 * 아키타입 기반 코칭 문구 생성 — MVP: archetype_templates DB 조회 방식
 *
 * 6-Step Pipeline:
 *   Step 1: 입력 검증 + Rate Limit
 *   Step 2: PII 전처리 (maskPII — Lock 7)
 *   Step 3: 비용 체크 (Lock 5 가드레일) → MVP: DB 조회이므로 비용 0
 *   Step 4: 후처리 (Lock 6 투자자문 금지 필터)
 *   Step 5: 로그 기록 (ai_call_logs INSERT — 생략 불가)
 *   Step 6: DB upsert (coaching_cards — Idempotency 필수)
 *
 * Lock 5: 월 $5 초과 시 fallback 반환
 * Lock 6: 투자자문 금지 필터 필수
 * Lock 7: PII 마스킹 함수 maskPII() 적용 필수
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── Constants ───

const FUNCTION_NAME = 'generate-coaching';
const RATE_LIMIT_PER_MINUTE = 10;
const COST_BLOCK_THRESHOLD_USD = 5.0;

const FALLBACK_MESSAGE =
  '오늘의 원칙을 다시 확인해보세요. 일지를 작성하면 내일 새로운 코칭이 준비됩니다.';

// Lock 6 금지 키워드
const LEGAL_FILTER_KEYWORDS = [
  '매수 추천', '매도 추천', '목표가', '수익 보장',
  '할 것입니다', '오를 것', '떨어질 것',
];

// Lock 6 면책 고지문 (고정값 — 동적 생성 금지)
const LEGAL_DISCLAIMER =
  '[중요 고지사항] 본 진단 결과는 귀하의 투자 행동 패턴에 대한 자기 인식을 돕기 위한 교육적 도구로서, 특정 금융투자상품에 대한 투자 권유, 매수·매도 추천, 또는 투자 적합성 판단을 목적으로 하지 않습니다. 본 서비스는 「자본시장과 금융투자업에 관한 법률」에 따른 투자자문업에 해당하지 않으며, 해당 법률에 따른 등록 투자자문업자의 서비스를 대체하지 않습니다. 진단 결과는 귀하의 행동 경향성을 참고하는 용도로만 사용하시기 바라며, 실제 투자 결정은 귀하 본인의 판단과 책임 하에 이루어져야 합니다. 투자에는 원금 손실의 위험이 있습니다. 본 진단 결과에 기반한 투자 손실에 대하여 (주)글로보더는 법적 책임을 부담하지 않습니다.';

// ─── Step 1: Rate Limit ───

async function checkRateLimit(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
): Promise<boolean> {
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count, error } = await supabaseAdmin
    .from('ai_call_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('function_name', FUNCTION_NAME)
    .gte('created_at', oneMinuteAgo);

  if (error) {
    console.error('Rate limit check failed:', error);
    return false;
  }
  return (count ?? 0) >= RATE_LIMIT_PER_MINUTE;
}

// ─── Step 2: PII 마스킹 (Lock 7) ───

function maskPII(text: string): string {
  let masked = text;
  // 전화번호 마스킹
  masked = masked.replace(/\d{2,3}-\d{3,4}-\d{4}/g, '[PHONE]');
  // 이메일 마스킹
  masked = masked.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL]');
  // 계좌번호 패턴 마스킹 (연속 숫자 10자리 이상)
  masked = masked.replace(/\d{10,}/g, '[ACCOUNT]');
  return masked;
}

// ─── Step 3: 비용 체크 (Lock 5) ───

async function getMonthlyAICost(
  supabaseAdmin: ReturnType<typeof createClient>,
): Promise<number> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { data, error } = await supabaseAdmin
    .from('ai_call_logs')
    .select('estimated_cost_usd')
    .gte('created_at', monthStart.toISOString());

  if (error || !data) return 0;
  return data.reduce((sum, row) => sum + Number(row.estimated_cost_usd), 0);
}

// ─── Step 4: 법적 필터 (Lock 6) ───

function legalPostFilter(text: string): { passed: boolean; filtered: string } {
  for (const keyword of LEGAL_FILTER_KEYWORDS) {
    if (text.includes(keyword)) {
      return { passed: false, filtered: text };
    }
  }
  return { passed: true, filtered: text };
}

// ─── Main Handler ───

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const supabaseAnon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Step 1: Rate Limit
    const rateLimited = await checkRateLimit(supabaseAdmin, user.id);
    if (rateLimited) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const today = new Date().toISOString().split('T')[0];

    // Step 3: 비용 체크 (Lock 5)
    const monthlyCost = await getMonthlyAICost(supabaseAdmin);
    if (monthlyCost >= COST_BLOCK_THRESHOLD_USD) {
      // 비용 초과 → fallback 반환 + feature_flags 비활성화
      try {
        await supabaseAdmin
          .from('feature_flags')
          .update({ enabled: false, updated_at: new Date().toISOString() })
          .eq('key', 'coaching_ai');
      } catch (e) {
        console.error('Feature flag update failed:', e);
      }

      // fallback도 coaching_cards에 저장 (Idempotency)
      await supabaseAdmin.from('coaching_cards').upsert(
        {
          user_id: user.id,
          card_date: today,
          archetype: 'mixed',
          content: FALLBACK_MESSAGE,
          source: 'template',
        },
        { onConflict: 'user_id,card_date' },
      );

      return new Response(JSON.stringify({
        success: true,
        coaching: { message: FALLBACK_MESSAGE, source: 'fallback' },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 사용자 아키타입 조회
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('coaching_archetype')
      .eq('id', user.id)
      .single();

    const archetype = userData?.coaching_archetype || 'mixed';

    // MVP: archetype_templates DB 조회 (RAG 대체)
    const { data: templates } = await supabaseAdmin
      .from('archetype_templates')
      .select('content')
      .eq('archetype', archetype)
      .eq('category', 'daily_nudge')
      .eq('is_active', true);

    let coachingMessage: string;

    if (!templates || templates.length === 0) {
      coachingMessage = FALLBACK_MESSAGE;
    } else {
      // 랜덤 선택
      const randomIndex = Math.floor(Math.random() * templates.length);
      coachingMessage = templates[randomIndex].content;
    }

    // Step 2: PII 마스킹 (Lock 7 — 템플릿에 사용자 데이터 포함 시 대비)
    coachingMessage = maskPII(coachingMessage);

    // Step 4: 법적 필터 (Lock 6)
    const filterResult = legalPostFilter(coachingMessage);
    if (!filterResult.passed) {
      // 금지 표현 포함 → fallback + error_logs 기록
      try {
        await supabaseAdmin.from('error_logs').insert({
          user_id: user.id,
          type: 'legal_filter_violation',
          message: `Legal filter triggered in ${FUNCTION_NAME}`,
          metadata: { original_content: filterResult.filtered },
        });
      } catch (e) {
        console.error('Error log insert failed:', e);
      }

      coachingMessage = FALLBACK_MESSAGE;
    }

    // Step 5: 로그 기록 (생략 불가)
    try {
      await supabaseAdmin.from('ai_call_logs').insert({
        user_id: user.id,
        function_name: FUNCTION_NAME,
        model: 'none',  // MVP: DB 조회, AI 호출 없음
        input_tokens: 0,
        output_tokens: 0,
        estimated_cost_usd: 0,
      });
    } catch (logError) {
      console.error('ai_call_logs insert failed:', logError);
    }

    // Step 6: DB upsert (Idempotency — UNIQUE user_id + date)
    const { error: upsertError } = await supabaseAdmin
      .from('coaching_cards')
      .upsert(
        {
          user_id: user.id,
          card_date: today,
          archetype,
          content: coachingMessage,
          source: 'template',
        },
        { onConflict: 'user_id,card_date' },
      );

    if (upsertError) {
      throw upsertError;
    }

    return new Response(JSON.stringify({
      success: true,
      coaching: {
        message: coachingMessage,
        archetype,
        disclaimer: LEGAL_DISCLAIMER,
        source: 'template',
        date: today,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
