/**
 * generate-coaching Edge Function
 * 아키타입 기반 코칭 문구 생성.
 *
 * 마스터플랜 0617 — Pillar 4: Claude 연동(Stage 1) 추가.
 *   - 게이트: ANTHROPIC_API_KEY 존재 AND feature_flags.coaching_ai = true 일 때만 Claude 호출.
 *   - 둘 중 하나라도 없으면 기존 archetype_templates DB 조회로 폴백(현 동작과 100% 동일).
 *   - Claude 실패/법적필터 위반 시에도 템플릿/fallback으로 안전 폴백.
 *
 * 6-Step Pipeline:
 *   Step 1: 입력 검증 + Rate Limit
 *   Step 2: PII 전처리 (maskPII — Lock 7)
 *   Step 3: 비용 체크 (Lock 5 가드레일) → 초과 시 fallback
 *   Step 4: 후처리 (Lock 6 투자자문 금지 필터)
 *   Step 5: 로그 기록 (ai_call_logs INSERT — 생략 불가, Claude 사용 시 실제 model/tokens/cost)
 *   Step 6: DB upsert (coaching_cards — Idempotency 필수)
 *
 * Lock 1: 클라이언트 직접 LLM 호출 금지 — 본 EF가 유일 진입점
 * Lock 5: 월 $5 경고 / $10 차단 (ai_call_logs 집계)
 * Lock 6: 투자자문 금지 필터 필수
 * Lock 7: PII 마스킹(maskPII) 후에만 외부 모델 전달
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── Constants ───

const FUNCTION_NAME = 'generate-coaching';
const RATE_LIMIT_PER_MINUTE = 10;
const COST_BLOCK_THRESHOLD_USD = 5.0;

// Claude (Pillar 4 Stage 1) — 인앱 코칭 모델
const ANTHROPIC_MODEL = 'claude-haiku-4-5';
const ANTHROPIC_VERSION = '2023-06-01';
const COACHING_MAX_TOKENS = 320;
// Anthropic 공식 단가 (USD per 1M tokens) — claude-haiku-4-5: $1.00 in / $5.00 out
// 변경 시 Anthropic 가격표 기준으로 갱신할 것.
const HAIKU_INPUT_USD_PER_MTOK = 1.0;
const HAIKU_OUTPUT_USD_PER_MTOK = 5.0;

const FALLBACK_MESSAGE =
  '오늘의 원칙을 다시 확인해보세요. 일지를 작성하면 내일 새로운 코칭이 준비됩니다.';

// Lock 6 금지 표현 (LEGAL-001) — admin-briefing 정규식 세트의 superset.
// 단순 부분문자열(includes) 대신 정규식 + 공백/제로폭 정규화로 우회를 차단한다.
// (S1에서 supabase/functions/_shared/legalFilter.ts로 추출해 EF 간 SSOT화 예정.)
const LEGAL_FORBIDDEN_PATTERNS: RegExp[] = [
  /매수\s*추천/, /매도\s*추천/, /매수\s*하세요/, /매도\s*하세요/,
  /목표가/, /적정가/, /수익\s*보장/, /원금\s*보장/,
  /할\s*것입니다/, /오를\s*것/, /떨어질\s*것/,
  /상승할\s*것/, /하락할\s*것/, /반등할\s*것/, /급등할\s*것/, /급락할\s*것/,
  /비중\s*확대/, /비중\s*축소/,
  /\d+\s*[%％]\s*(상승|하락|오를|떨어질|수익|손실)/,
];

// Lock 6 면책 고지문 (고정값 — 동적 생성 금지)
const LEGAL_DISCLAIMER =
  '[중요 고지사항] 본 진단 결과는 귀하의 투자 행동 패턴에 대한 자기 인식을 돕기 위한 교육적 도구로서, 특정 금융투자상품에 대한 투자 권유, 매수·매도 추천, 또는 투자 적합성 판단을 목적으로 하지 않습니다. 본 서비스는 「자본시장과 금융투자업에 관한 법률」에 따른 투자자문업에 해당하지 않으며, 해당 법률에 따른 등록 투자자문업자의 서비스를 대체하지 않습니다. 진단 결과는 귀하의 행동 경향성을 참고하는 용도로만 사용하시기 바라며, 실제 투자 결정은 귀하 본인의 판단과 책임 하에 이루어져야 합니다. 투자에는 원금 손실의 위험이 있습니다. 본 진단 결과에 기반한 투자 손실에 대하여 INVIT는 법적 책임을 부담하지 않습니다.';

// 코칭 시스템 프롬프트 (자본시장법 제약 명시)
const COACHING_SYSTEM_PROMPT =
  '당신은 한국 개인투자자의 행동 편향 교정을 돕는 코칭 어시스턴트입니다. ' +
  '사용자의 투자 일지 요약과 행동 아키타입을 바탕으로, 오늘 하루 자기 인식을 돕는 ' +
  '따뜻하고 구체적인 코칭 메시지를 한국어로 2~3문장 작성하세요. ' +
  '절대 금지: 특정 종목 언급, 목표가·가격 예측, 매수·매도 추천, 수익 보장, 단정적 미래 표현. ' +
  '오직 행동·감정·원칙 준수에 대한 성찰만 다루세요. 메시지 본문만 출력하고 다른 말은 덧붙이지 마세요.';

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
  // 주민등록번호 (6-7) — 전화/계좌보다 먼저
  masked = masked.replace(/\d{6}\s*-\s*\d{7}/g, '[RRN]');
  // 카드번호 (4-4-4-4)
  masked = masked.replace(/\d{4}[- ]\d{4}[- ]\d{4}[- ]\d{4}/g, '[CARD]');
  // 전화번호
  masked = masked.replace(/\d{2,3}-\d{3,4}-\d{4}/g, '[PHONE]');
  // 이메일
  masked = masked.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL]');
  // 계좌/장수 숫자 (연속 숫자 10자리 이상)
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

/** 공백 변형(이중·전각공백)·제로폭 문자 삽입 우회를 차단하기 위해 정규화. */
function normalizeForFilter(text: string): string {
  return text
    .replace(/[​‌‍﻿]/g, '') // 제로폭 문자(ZWSP/ZWNJ/ZWJ/BOM) 제거 — 자모 사이 우회 삽입 차단
    .replace(/ /g, ' ')                     // NBSP → 일반 공백
    .replace(/\s+/g, ' ');                       // 연속 공백 축약
}

function legalPostFilter(text: string): { passed: boolean; filtered: string; pattern?: string } {
  const normalized = normalizeForFilter(text);
  for (const re of LEGAL_FORBIDDEN_PATTERNS) {
    if (re.test(normalized)) {
      return { passed: false, filtered: text, pattern: re.toString() };
    }
  }
  return { passed: true, filtered: text };
}

// ─── Claude 게이트 헬퍼 (Pillar 4) ───

async function isCoachingAiEnabled(
  supabaseAdmin: ReturnType<typeof createClient>,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('feature_flags')
    .select('enabled')
    .eq('key', 'coaching_ai')
    .single();
  if (error || !data) return false;
  return data.enabled === true;
}

interface JournalContext {
  emotion_checkin?: number;
  trade_action?: string;
  trade_rationale?: string | null;
  bias_check?: boolean | null;
  trade_reason_tags?: string[] | null;
}

interface PrincipleHint {
  body_text: string;
  source_author: string;
}

async function fetchRelevantPrinciples(
  supabaseAdmin: ReturnType<typeof createClient>,
  archetype: string,
): Promise<PrincipleHint[]> {
  try {
    const { data, error } = await supabaseAdmin.rpc('get_principles_by_archetype', {
      p_archetype: archetype,
      p_limit: 3,
    });
    if (error || !data) return [];
    return (data as PrincipleHint[]).map((r) => ({
      body_text: r.body_text,
      source_author: r.source_author,
    }));
  } catch {
    return [];
  }
}

function buildUserContext(
  archetype: string,
  journal: JournalContext | null,
  principles: PrincipleHint[],
): string {
  const lines: string[] = [`행동 아키타입: ${archetype}`];
  if (journal) {
    if (typeof journal.emotion_checkin === 'number') {
      lines.push(`오늘 감정(1=공포 3=평온 5=흥분): ${journal.emotion_checkin}`);
    }
    // Lock 7 — 외부 모델 전달 전 사용자유래 필드 전수 마스킹
    if (journal.trade_action) lines.push(`오늘 매매: ${maskPII(journal.trade_action)}`);
    if (journal.trade_reason_tags && journal.trade_reason_tags.length > 0) {
      lines.push(`매매 이유 태그: ${maskPII(journal.trade_reason_tags.join(', '))}`);
    }
    if (journal.bias_check === false) lines.push('본인이 편향이 있었다고 표시함');
    if (journal.trade_rationale) {
      // Lock 7: 외부 모델 전달 전 PII 마스킹
      lines.push(`일지 메모(요약): ${maskPII(journal.trade_rationale).slice(0, 300)}`);
    }
  } else {
    lines.push('오늘 일지 데이터 없음');
  }
  // 관련 투자 원칙 (Pillar 2 RAG — get_principles_by_archetype)
  if (principles.length > 0) {
    lines.push('\n[관련 원칙 — 코칭에 자연스럽게 녹여 사용하세요]');
    principles.forEach((p, i) => {
      lines.push(`${i + 1}. "${p.body_text}" — ${p.source_author}`);
    });
  }
  return lines.join('\n');
}

interface ClaudeResult {
  message: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

async function generateWithClaude(
  apiKey: string,
  archetype: string,
  journal: JournalContext | null,
  principles: PrincipleHint[] = [],
): Promise<ClaudeResult> {
  const userContext = buildUserContext(archetype, journal, principles);
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: COACHING_MAX_TOKENS,
      system: COACHING_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContext }],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Anthropic API ${resp.status}: ${errText}`);
  }

  const data = await resp.json();
  const textBlock = Array.isArray(data.content)
    ? data.content.find((b: { type: string }) => b.type === 'text')
    : null;
  const message = textBlock?.text?.trim();
  if (!message) throw new Error('Empty Claude response');

  return {
    message,
    model: data.model ?? ANTHROPIC_MODEL,
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  };
}

function computeCost(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * HAIKU_INPUT_USD_PER_MTOK +
    (outputTokens / 1_000_000) * HAIKU_OUTPUT_USD_PER_MTOK
  );
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

    const archetype = (userData?.coaching_archetype as string) || 'mixed';

    // ── 메시지 생성: Claude(게이트 통과 시) → 실패 시 템플릿 폴백 ──
    let coachingMessage = '';
    let source: 'template' | 'ai_generated' = 'template';
    let usedModel = 'none';
    let inputTokens = 0;
    let outputTokens = 0;
    let costUsd = 0;

    // Secret 이름: ANTHROPIC_API_KEY 또는 CLAUDE_API_KEY 둘 다 지원
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') ?? Deno.env.get('CLAUDE_API_KEY');
    const coachingAiEnabled = anthropicKey ? await isCoachingAiEnabled(supabaseAdmin) : false;

    if (anthropicKey && coachingAiEnabled) {
      try {
        // 오늘 일지 컨텍스트 + 관련 원칙 병렬 조회 (Pillar 4 + Pillar 2 RAG)
        const [journalRes, principles] = await Promise.all([
          supabaseAdmin
            .from('investment_journals')
            .select('emotion_checkin, trade_action, trade_rationale, bias_check, trade_reason_tags')
            .eq('user_id', user.id)
            .eq('journal_date', today)
            .maybeSingle(),
          fetchRelevantPrinciples(supabaseAdmin, archetype),
        ]);
        const journal = journalRes.data as JournalContext | null;

        const result = await generateWithClaude(
          anthropicKey,
          archetype,
          journal,
          principles,
        );
        coachingMessage = result.message;
        usedModel = result.model;
        inputTokens = result.inputTokens;
        outputTokens = result.outputTokens;
        costUsd = computeCost(inputTokens, outputTokens);
        source = 'ai_generated';
      } catch (e) {
        console.error('Claude coaching failed, falling back to template:', e);
        // 폴백 — 아래 템플릿 경로로 진행
      }
    }

    // 템플릿 폴백 (Claude 미사용 또는 실패)
    if (!coachingMessage) {
      const { data: templates } = await supabaseAdmin
        .from('archetype_templates')
        .select('content')
        .eq('archetype', archetype)
        .eq('category', 'daily_nudge')
        .eq('is_active', true);

      if (!templates || templates.length === 0) {
        coachingMessage = FALLBACK_MESSAGE;
      } else {
        const randomIndex = Math.floor(Math.random() * templates.length);
        coachingMessage = templates[randomIndex].content as string;
      }
      source = 'template';
      usedModel = 'none';
      inputTokens = 0;
      outputTokens = 0;
      costUsd = 0;
    }

    // Step 2: PII 마스킹 (Lock 7)
    coachingMessage = maskPII(coachingMessage);

    // Step 4: 법적 필터 (Lock 6)
    const filterResult = legalPostFilter(coachingMessage);
    if (!filterResult.passed) {
      try {
        await supabaseAdmin.from('error_logs').insert({
          user_id: user.id,
          type: 'legal_filter_violation',
          message: `Legal filter triggered in ${FUNCTION_NAME}`,
          metadata: { original_content: filterResult.filtered, source },
        });
      } catch (e) {
        console.error('Error log insert failed:', e);
      }
      // 위반 응답 폐기 → fallback (Claude 토큰 비용은 아래 로그에 그대로 기록)
      coachingMessage = FALLBACK_MESSAGE;
      source = 'template';
    }

    // Step 5: 로그 기록 (생략 불가) — Claude 사용 시 실제 model/tokens/cost
    try {
      await supabaseAdmin.from('ai_call_logs').insert({
        user_id: user.id,
        function_name: FUNCTION_NAME,
        model: usedModel,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        estimated_cost_usd: costUsd,
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
          source,
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
        source,
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
