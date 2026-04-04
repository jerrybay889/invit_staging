/**
 * check-fomo Edge Function
 * FOMO Threshold LOCK v1.0 — KOSPI ±2% + 거래량 +150% → 경보 발송
 *
 * 6-Step Pipeline:
 *   Step 1: 입력 검증 + Rate Limit
 *   Step 2: (PII 전처리 — 해당 없음, 시장 데이터 전용)
 *   Step 3: (모델 호출 — 해당 없음, 임계값 비교 로직)
 *   Step 4: FOMO 경보 판정 (LOCK 임계값 기준)
 *   Step 5: 로그 기록 (ai_call_logs INSERT — 생략 불가)
 *   Step 6: DB upsert (fomo_alerts — Idempotency 필수)
 *
 * MVP: surge_standard / plunge_standard 2종만 구현.
 * elevated 타입 구현 금지 (Phase 2 이관 LOCKED).
 *
 * Trigger: pg_cron 장 마감 후 1회 / 수동 호출
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── FOMO Thresholds (LOCKED v1.0 — 변경 금지) ───

const FOMO_THRESHOLDS = {
  KOSPI_SURGE_THRESHOLD: 2.0,
  KOSPI_PLUNGE_THRESHOLD: -2.0,
  VOLUME_SURGE_PCT: 150,
  VOLUME_LOOKBACK_DAYS: 20,
  COOLDOWN_HOURS: 24,
} as const;

// 경보 메시지 (LOCKED — 동적 생성 금지)
const FOMO_MESSAGES = {
  surge_standard:
    '오늘 시장이 크게 올랐습니다. 이런 날 충동 매수한 개인 투자자의 6개월 평균 수익률은 −8.3%입니다. 오늘의 원칙을 먼저 확인해 보세요.',
  plunge_standard:
    '오늘 시장이 크게 떨어졌습니다. \'지금이 기회\'라는 감정은 손실회피 편향 신호입니다. 충동 매수 전 원칙 일지를 먼저 기록하세요.',
} as const;

const FUNCTION_NAME = 'check-fomo';
const RATE_LIMIT_PER_MINUTE = 10;

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

// ─── Step 4: FOMO 판정 ───

type FOMODirection = 'surge' | 'plunge';
type FOMOAlertType = 'surge_standard' | 'plunge_standard';

interface MarketData {
  kospi_change_pct: number;
  volume_change_pct: number;
}

interface FOMOResult {
  triggered: boolean;
  direction?: FOMODirection;
  alert_type?: FOMOAlertType;
  message?: string;
}

function evaluateFOMO(market: MarketData): FOMOResult {
  // Layer 1: KOSPI 변동률 체크
  const isSurge = market.kospi_change_pct >= FOMO_THRESHOLDS.KOSPI_SURGE_THRESHOLD;
  const isPlunge = market.kospi_change_pct <= FOMO_THRESHOLDS.KOSPI_PLUNGE_THRESHOLD;

  if (!isSurge && !isPlunge) {
    return { triggered: false };
  }

  // Layer 2: 거래량 체크 (AND 조건)
  if (market.volume_change_pct < FOMO_THRESHOLDS.VOLUME_SURGE_PCT) {
    return { triggered: false };
  }

  const direction: FOMODirection = isSurge ? 'surge' : 'plunge';
  const alertType: FOMOAlertType = `${direction}_standard`;

  return {
    triggered: true,
    direction,
    alert_type: alertType,
    message: FOMO_MESSAGES[alertType],
  };
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

    // Step 1: 입력 검증
    const body = await req.json();
    const today = body.date || new Date().toISOString().split('T')[0];

    if (body.kospi_change_pct == null || body.volume_change_pct == null) {
      return new Response(JSON.stringify({ error: 'kospi_change_pct and volume_change_pct are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const marketData: MarketData = {
      kospi_change_pct: Number(body.kospi_change_pct),
      volume_change_pct: Number(body.volume_change_pct),
    };

    // Step 4: FOMO 판정
    const result = evaluateFOMO(marketData);

    if (!result.triggered) {
      // 경보 미발동 — 로그만 기록 후 종료
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

      return new Response(JSON.stringify({
        success: true,
        triggered: false,
        reason: 'Thresholds not met',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 쿨다운 체크: 동일 방향 24시간 내 재발동 금지 (LOCKED)
    const cooldownSince = new Date(Date.now() - FOMO_THRESHOLDS.COOLDOWN_HOURS * 3600_000).toISOString();
    const { data: recentAlerts } = await supabaseAdmin
      .from('fomo_alerts')
      .select('id')
      .eq('user_id', user.id)
      .eq('direction', result.direction!)
      .gte('created_at', cooldownSince);

    if (recentAlerts && recentAlerts.length > 0) {
      return new Response(JSON.stringify({
        success: true,
        triggered: false,
        reason: 'Cooldown active',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

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

    // Step 6: DB upsert (Idempotency — UNIQUE user_id + date + direction)
    const cooldownUntil = new Date(Date.now() + FOMO_THRESHOLDS.COOLDOWN_HOURS * 3600_000).toISOString();

    const { error: upsertError } = await supabaseAdmin
      .from('fomo_alerts')
      .upsert(
        {
          user_id: user.id,
          alert_date: today,
          alert_type: result.alert_type!,
          kospi_change_pct: marketData.kospi_change_pct,
          volume_change_pct: marketData.volume_change_pct,
          message: result.message!,
          direction: result.direction!,
          cooldown_until: cooldownUntil,
        },
        { onConflict: 'user_id,alert_date,direction' },
      );

    if (upsertError) {
      throw upsertError;
    }

    return new Response(JSON.stringify({
      success: true,
      triggered: true,
      alert_type: result.alert_type,
      direction: result.direction,
      message: result.message,
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
