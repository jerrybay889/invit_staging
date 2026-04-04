/**
 * submit-bias-assessment Edge Function
 * Schema LOCK v1.0 — 편향 진단 7문항 → bias_flags → archetype → DB INSERT
 *
 * 6-Step Pipeline:
 *   Step 1: 입력 검증
 *   Step 2: (PII 전처리 — 해당 없음)
 *   Step 3: (모델 호출 — 해당 없음, 순수 로직)
 *   Step 4: bias_flags + archetype + next_retest_at 산출
 *   Step 5: 로그 기록 (생략 — AI 호출 없음)
 *   Step 6: DB INSERT (service_role)
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── Types ───

interface BiasAnswers {
  q1: number;
  q2: number;
  q3: number;
  q4: number;
  q5: number;
  q6: number;
  q7: number;
}

interface BiasFlags {
  loss_aversion: boolean;
  fomo: boolean;
  overconfidence: boolean;
  disposition: boolean;
  herding: boolean;
  present_bias: boolean;
  confirmation: boolean;
}

type Archetype =
  | 'panic_reactor'
  | 'overconfident_holder'
  | 'theme_chaser'
  | 'rationalized_biased'
  | 'shortterm_drifter'
  | 'mixed';

type TriggerSource =
  | 'onboarding'
  | 'scheduled'
  | 'market_event'
  | 'module_complete'
  | 'user_request';

const VALID_TRIGGERS: TriggerSource[] = [
  'onboarding', 'scheduled', 'market_event', 'module_complete', 'user_request',
];

// ─── Step 1: 입력 검증 ───

function validateAnswers(answers: unknown): BiasAnswers {
  if (!answers || typeof answers !== 'object') {
    throw new Error('answers is required and must be an object');
  }

  const a = answers as Record<string, unknown>;
  const errors: string[] = [];

  // q1~q3, q5, q7: 1~5
  for (const key of ['q1', 'q2', 'q3', 'q5', 'q7']) {
    const val = Number(a[key]);
    if (!Number.isInteger(val) || val < 1 || val > 5) {
      errors.push(`${key} must be integer 1~5, got ${a[key]}`);
    }
  }

  // q4: 1~3 (3-point forced choice)
  const q4 = Number(a.q4);
  if (!Number.isInteger(q4) || q4 < 1 || q4 > 3) {
    errors.push(`q4 must be integer 1~3, got ${a.q4}`);
  }

  // q6: 1~5 (역방향이지만 값 범위는 동일)
  const q6 = Number(a.q6);
  if (!Number.isInteger(q6) || q6 < 1 || q6 > 5) {
    errors.push(`q6 must be integer 1~5, got ${a.q6}`);
  }

  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join('; ')}`);
  }

  return {
    q1: Number(a.q1),
    q2: Number(a.q2),
    q3: Number(a.q3),
    q4: Number(a.q4),
    q5: Number(a.q5),
    q6: Number(a.q6),
    q7: Number(a.q7),
  };
}

// ─── Step 4: bias_flags 산출 ───

function calculateBiasFlags(answers: BiasAnswers): BiasFlags {
  return {
    loss_aversion: answers.q1 >= 4,
    fomo:          answers.q2 >= 4,
    overconfidence: answers.q3 >= 4,
    disposition:   answers.q4 === 1,       // 3-point: 1=편향 최강
    herding:       answers.q5 >= 4,
    present_bias:  answers.q6 <= 2,        // 역방향: 낮을수록 편향↑
    confirmation:  answers.q7 >= 4,
  };
}

// ─── Step 4: archetype 판정 (우선순위 순) ───

function determineArchetype(flags: BiasFlags): Archetype {
  if (flags.loss_aversion && flags.fomo && flags.herding) {
    return 'panic_reactor';
  }
  if (flags.overconfidence && flags.confirmation && flags.disposition) {
    return 'overconfident_holder';
  }
  if (flags.fomo && flags.herding && flags.present_bias) {
    return 'theme_chaser';
  }
  if (flags.overconfidence && flags.confirmation) {
    return 'rationalized_biased';
  }
  if (flags.present_bias && flags.loss_aversion) {
    return 'shortterm_drifter';
  }
  return 'mixed';
}

// ─── Step 4: next_retest_at 산출 ───

function calculateRetestDates(diagnosedAt: Date): Record<string, string> {
  const addMonths = (date: Date, months: number): string => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d.toISOString();
  };

  return {
    // state-like: +3개월
    fomo:           addMonths(diagnosedAt, 3),
    herding:        addMonths(diagnosedAt, 3),
    // 중간: +6개월
    overconfidence: addMonths(diagnosedAt, 6),
    // trait-like: +12개월
    loss_aversion:  addMonths(diagnosedAt, 12),
    disposition:    addMonths(diagnosedAt, 12),
    present_bias:   addMonths(diagnosedAt, 12),
    confirmation:   addMonths(diagnosedAt, 12),
  };
}

// ─── Main Handler ───

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // Auth 검증
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Supabase 클라이언트 (service_role — DB 쓰기용)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 사용자 JWT에서 user_id 추출
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

    // Step 1: 입력 검증
    const body = await req.json();
    const answers = validateAnswers(body.answers);
    const triggerSource: TriggerSource =
      VALID_TRIGGERS.includes(body.trigger_source) ? body.trigger_source : 'onboarding';

    // Step 4: 산출
    const biasFlags = calculateBiasFlags(answers);
    const archetype = determineArchetype(biasFlags);
    const diagnosedAt = new Date();
    const nextRetestAt = calculateRetestDates(diagnosedAt);

    // Step 6: DB INSERT (service_role)
    const { data: assessment, error: insertError } = await supabaseAdmin
      .from('bias_assessments')
      .insert({
        user_id: user.id,
        answers,
        bias_flags: biasFlags,
        archetype,
        next_retest_at: nextRetestAt,
        diagnosed_at: diagnosedAt.toISOString(),
        trigger_source: triggerSource,
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    // users 테이블 갱신
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        bias_profile: biasFlags,
        coaching_archetype: archetype,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('User update failed:', updateError);
      // 비치명적 — assessment는 이미 저장됨
    }

    return new Response(JSON.stringify({
      success: true,
      assessment: {
        id: assessment.id,
        archetype,
        bias_flags: biasFlags,
        next_retest_at: nextRetestAt,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('Validation') ? 400 : 500;

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
