/**
 * calculate-discipline Edge Function
 * Discipline Score LOCK v1.0 — 일일 규율 점수 산출
 *
 * 6-Step Pipeline:
 *   Step 1: 입력 검증 + Rate Limit
 *   Step 2: (PII 전처리 — 해당 없음)
 *   Step 3: (모델 호출 — 해당 없음, 순수 산식)
 *   Step 4: 규율 점수 산출 (LOCK 산식 40/40/20)
 *   Step 5: 로그 기록 (ai_call_logs INSERT — 생략 불가)
 *   Step 6: DB upsert (discipline_logs + users.discipline_score 갱신)
 *
 * 산식 (LOCKED — 변경 금지):
 *   D_score = (J_score × 0.40) + (P_score × 0.40) + (E_score × 0.20)
 *
 * Trigger: 일지 저장 완료 시 / pg_cron 자정 1회
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CORS_HEADERS } from '../_shared/auth.ts';

// ─── Constants (LOCKED) ───

const FUNCTION_NAME = 'calculate-discipline';
const RATE_LIMIT_PER_MINUTE = 10;

const WEIGHTS = {
  JOURNAL: 0.40,
  PRINCIPLE: 0.40,
  EMOTION: 0.20,
} as const;

const MAX_WITHOUT_JOURNAL = 60;

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

// ─── Step 4: Emotion Score — Inverted-V (LOCKED) ───

function calculateEmotionScore(emotionCheckin: number): number {
  return (1 - Math.abs(emotionCheckin - 3) / 2) * 100;
}

// ─── Step 4: Journal Score (LOCKED) ───

function calculateJournalScore(journal: {
  entry_completed: boolean;
  trade_rationale: boolean;
  bias_check: boolean | null;
}): number {
  const entryCompleted = journal.entry_completed ? 50 : 0;
  const tradeRationale = journal.trade_rationale ? 30 : 0;
  // bias_check null → true 자동 (LOCKED 엣지 케이스)
  const biasCheck = (journal.bias_check ?? true) ? 20 : 0;
  return entryCompleted + tradeRationale + biasCheck;
}

// ─── Step 4: principle_compliance 텍스트 → 준수율 변환 ───
// 'kept'=100% / 'partial'=50% / 'broken'=0% / null=기존 principle_checks 폴백

function resolvePrincipleCompliance(
  principleComplianceText: string | null | undefined,
  principleChecks: Record<string, boolean>,
): number {
  if (principleComplianceText === 'kept')    return 1.0;
  if (principleComplianceText === 'partial') return 0.5;
  if (principleComplianceText === 'broken')  return 0.0;
  // null/undefined → 기존 principle_checks JSONB 폴백
  const values = Object.values(principleChecks) as boolean[];
  return values.length > 0
    ? values.filter(Boolean).length / values.length
    : 1;
}

// ─── Step 4: trade_reason_tags → trade_rationale boolean 변환 ───
// tags 배열이 비어 있지 않으면 매매이유 기록 완료로 판정

function resolveTradeRationale(
  existingTradeRationale: boolean,
  tradeReasonTags: string[] | null | undefined,
): boolean {
  if (Array.isArray(tradeReasonTags) && tradeReasonTags.length > 0) return true;
  return existingTradeRationale;
}

// ─── Step 4: Principle Score (LOCKED) ───

function calculatePrincipleScore(principle: {
  entry_rule: boolean;
  exit_rule: boolean;
  no_impulse: boolean;
}): number {
  const entryRule = principle.entry_rule ? 40 : 0;
  const exitRule = principle.exit_rule ? 40 : 0;
  const noImpulse = principle.no_impulse ? 20 : 0;
  return entryRule + exitRule + noImpulse;
}

// ─── Main Handler ───

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    // Auth 검증
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
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
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Step 1: Rate Limit
    const rateLimited = await checkRateLimit(supabaseAdmin, user.id);
    if (rateLimited) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Step 1: 입력 검증
    const body = await req.json();
    const today = body.date || new Date().toISOString().split('T')[0];

    // emotion_checkin 미입력 → 409 반환 (LOCKED 엣지 케이스)
    if (body.emotion_checkin == null) {
      return new Response(JSON.stringify({ error: 'emotion_checkin is required' }), {
        status: 409,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const emotionCheckin = Number(body.emotion_checkin);
    if (!Number.isInteger(emotionCheckin) || emotionCheckin < 1 || emotionCheckin > 5) {
      return new Response(JSON.stringify({ error: 'emotion_checkin must be 1~5' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // 오늘의 일지 조회
    const { data: journal } = await supabaseAdmin
      .from('investment_journals')
      .select('*')
      .eq('user_id', user.id)
      .eq('journal_date', today)
      .single();

    // 오늘의 FOMO 경보 조회 (no_impulse 판정용)
    const { data: fomoAlerts } = await supabaseAdmin
      .from('fomo_alerts')
      .select('*')
      .eq('user_id', user.id)
      .eq('alert_date', today);

    const hasFomoAlert = (fomoAlerts?.length ?? 0) > 0;
    const hasTradeAfterFomo = hasFomoAlert && journal?.trade_action !== 'none';

    // ─── Step 4: 규율 점수 산출 (LOCKED 산식) ───

    // Journal Score
    const journalExists = !!journal;

    // trade_reason_tags (J01 신규 필드) → trade_rationale 판정 보강
    const tradeReasonTags: string[] | null = journal?.trade_reason_tags ?? null;
    const tradeRationale = resolveTradeRationale(!!journal?.trade_rationale, tradeReasonTags);

    const jScore = journalExists
      ? calculateJournalScore({
          entry_completed: true,
          trade_rationale: tradeRationale,
          bias_check: journal.bias_check,
        })
      : 0;

    // Principle Score
    // 당일 매매 없음 → entry_rule = true, exit_rule = true (LOCKED 엣지 케이스)
    const noTrade = !journal || journal.trade_action === 'none' || journal.has_trade === false;

    // principle_compliance (J01 신규 필드) → 준수율 우선 사용, 없으면 principle_checks 폴백
    const principleComplianceText: string | null = journal?.principle_compliance ?? null;
    const principleChecks: Record<string, boolean> = journal?.principle_checks ?? {};
    const principleCompliance = resolvePrincipleCompliance(principleComplianceText, principleChecks);

    const pScore = calculatePrincipleScore({
      entry_rule: noTrade ? true : principleCompliance >= 0.5,
      exit_rule: noTrade ? true : principleCompliance >= 0.5,
      // FOMO 경보 미발동 → no_impulse = true (LOCKED)
      // FOMO 경보 발동 후 미거래 → true
      // FOMO 경보 발동 후 거래 → false
      no_impulse: !hasFomoAlert || !hasTradeAfterFomo,
    });

    // Emotion Score — Inverted-V (LOCKED)
    const eScore = calculateEmotionScore(emotionCheckin);

    // 최종 점수
    let totalScore = Math.round(
      jScore * WEIGHTS.JOURNAL +
      pScore * WEIGHTS.PRINCIPLE +
      eScore * WEIGHTS.EMOTION,
    );

    // 일지 미작성 시 최대 60점 상한 (LOCKED 엣지 케이스)
    if (!journalExists && totalScore > MAX_WITHOUT_JOURNAL) {
      totalScore = MAX_WITHOUT_JOURNAL;
    }

    totalScore = Math.max(0, Math.min(100, totalScore));

    // Step 5: 로그 기록 (생략 불가)
    try {
      await supabaseAdmin.from('ai_call_logs').insert({
        user_id: user.id,
        function_name: FUNCTION_NAME,
        model: 'none',
        input_tokens: 0,
        output_tokens: 0,
        estimated_cost_usd: 0,
      });
    } catch (logError) {
      console.error('ai_call_logs insert failed:', logError);
    }

    // Step 6: DB upsert (Idempotency — UNIQUE user_id + date)
    const { error: upsertError } = await supabaseAdmin
      .from('discipline_logs')
      .upsert(
        {
          user_id: user.id,
          log_date: today,
          journal_score: jScore,
          principle_score: pScore,
          emotion_score: eScore,
          total_score: totalScore,
          calculation_detail: {
            journal_exists: journalExists,
            has_fomo_alert: hasFomoAlert,
            has_trade_after_fomo: hasTradeAfterFomo,
            emotion_checkin: emotionCheckin,
            principle_compliance_text: principleComplianceText,
            principle_compliance_ratio: principleCompliance,
            trade_reason_tags: tradeReasonTags,
            trade_rationale_resolved: tradeRationale,
          },
        },
        { onConflict: 'user_id,log_date' },
      );

    if (upsertError) {
      throw upsertError;
    }

    // users.discipline_score 갱신
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        discipline_score: totalScore,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('User discipline_score update failed:', updateError);
    }

    return new Response(JSON.stringify({
      success: true,
      discipline: {
        total_score: totalScore,
        journal_score: jScore,
        principle_score: pScore,
        emotion_score: eScore,
        date: today,
      },
    }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
