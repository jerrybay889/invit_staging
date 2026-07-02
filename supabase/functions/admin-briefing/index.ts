/**
 * admin-briefing Edge Function
 * Jerry가 수동으로 daily_briefings 테이블에 브리핑을 INSERT/UPSERT하는 어드민 전용 EF.
 * Gemini 자동 파이프라인이 준비되기 전 수동 운영 브릿지.
 *
 * 6-Step Pipeline:
 *   Step 1: 어드민 인증 + 입력 검증
 *   Step 2: 법적 사전 필터 (Lock 6 — 투자자문 금지)
 *   Step 3: (모델 호출 없음 — 건너뜀)
 *   Step 4: 법적 후처리 필터 + 출력 스키마 검증
 *   Step 5: 로그 기록 (ai_call_logs INSERT — 생략 불가)
 *   Step 6: daily_briefings upsert (Idempotency — UNIQUE briefing_date + source_channel)
 *
 * 어드민 인증 (게이트웨이 verify_jwt=true 필수 — 위조 JWT는 게이트웨이 서명검증에서 차단):
 *   ① Authorization: Bearer <service_role 키>  (서명검증된 JWT의 role 클레임 = 'service_role')
 *   ② 보조: x-admin-secret 헤더 = SYNC_SECRET (constant-time 비교)
 *
 * ⚠️ 절대 `--no-verify-jwt`로 배포 금지 (AUTHZ-001). verify_jwt=true에서만 isServiceRoleJwt가 안전.
 *
 * Lock 6 금지 표현:
 *   매수 추천 / 매도 추천 / 목표가 / 수익 보장
 *   ~할 것입니다 / ~오를 것 / ~떨어질 것 / 확정적 가격 예측
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FUNCTION_NAME = 'admin-briefing';

// ─── Lock 6: 투자자문 금지 필터 패턴 (LOCKED — 수정 금지) ───
const LEGAL_FORBIDDEN_PATTERNS: RegExp[] = [
  /매수\s*추천/,
  /매도\s*추천/,
  /목표가/,
  /수익\s*보장/,
  /할\s*것입니다/,
  /오를\s*것/,
  /떨어질\s*것/,
  /상승할\s*것/,
  /하락할\s*것/,
  /반등할\s*것/,
  /\d+[%％]\s*(상승|하락|오를|떨어질)/,
];

/** Lock 6 위반 여부 검사. 위반 패턴 첫 번째를 반환, 없으면 null. */
function detectLegalViolation(text: string): string | null {
  for (const pattern of LEGAL_FORBIDDEN_PATTERNS) {
    if (pattern.test(text)) {
      return pattern.toString();
    }
  }
  return null;
}

/** 여러 텍스트 필드에 대해 법적 필터를 일괄 적용. */
function applyLegalFilter(fields: Record<string, string | undefined | null>): {
  violation: boolean;
  field?: string;
  pattern?: string;
} {
  for (const [fieldName, value] of Object.entries(fields)) {
    if (!value) continue;
    const match = detectLegalViolation(value);
    if (match) {
      return { violation: true, field: fieldName, pattern: match };
    }
  }
  return { violation: false };
}

// ─── 어드민 인증 헬퍼 ───

/** 길이·내용 노출을 줄인 상수 시간 문자열 비교 (timing attack 완화). */
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ba = enc.encode(a);
  const bb = enc.encode(b);
  if (ba.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ba.length; i++) diff |= ba[i] ^ bb[i];
  return diff === 0;
}

/**
 * 게이트웨이 verify_jwt=true가 서명을 이미 검증한 전제 하에 role 클레임이 service_role인지 판별.
 * (이 함수는 서명검증을 하지 않으므로 verify_jwt=true 없이는 신뢰 불가 — AUTHZ-001.)
 */
function isServiceRoleJwt(authHeader: string): boolean {
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json);
    return payload?.role === 'service_role';
  } catch {
    return false;
  }
}

// ─── 입력 검증 헬퍼 ───

function isValidDateString(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
}

function isValidUuid(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

// ─── Main Handler ───

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers':
          'authorization, x-client-info, apikey, content-type, x-admin-secret',
      },
    });
  }

  try {
    // ── Step 1: 어드민 인증 ──
    const authHeader = req.headers.get('Authorization') ?? '';
    const syncSecret = Deno.env.get('SYNC_SECRET');
    const providedSecret = req.headers.get('x-admin-secret');

    const authorized =
      isServiceRoleJwt(authHeader) ||
      (!!syncSecret && !!providedSecret && safeEqual(providedSecret, syncSecret));

    if (!authorized) {
      return new Response(
        JSON.stringify({ error: 'Admin authorization required' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // ── Step 1: 입력 검증 ──
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const { briefing_date, source_channel, brief_title, summary } = body;

    if (!isValidDateString(briefing_date)) {
      return new Response(
        JSON.stringify({ error: 'briefing_date is required (YYYY-MM-DD)' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (!source_channel || typeof source_channel !== 'string' || !source_channel.trim()) {
      return new Response(
        JSON.stringify({ error: 'source_channel is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (!brief_title || typeof brief_title !== 'string' || !brief_title.trim()) {
      return new Response(
        JSON.stringify({ error: 'brief_title is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (!summary || typeof summary !== 'string' || !summary.trim()) {
      return new Response(
        JSON.stringify({ error: 'summary is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // 선택 필드 타입 검증
    const source_url = typeof body.source_url === 'string' ? body.source_url : null;
    const source_title = typeof body.source_title === 'string' ? body.source_title : null;
    const risk_signals = typeof body.risk_signals === 'string' ? body.risk_signals : null;
    const principle_hint = typeof body.principle_hint === 'string' ? body.principle_hint : null;
    const bias_warning = typeof body.bias_warning === 'string' ? body.bias_warning : null;
    const key_sectors = Array.isArray(body.key_sectors) ? body.key_sectors : [];
    const auto_approved =
      typeof body.auto_approved === 'boolean' ? body.auto_approved : true;

    const linked_principle_id =
      isValidUuid(body.linked_principle_id) ? body.linked_principle_id : null;

    // ── Step 2: 법적 사전 필터 (Lock 6) ──
    const preFilterResult = applyLegalFilter({
      brief_title: brief_title as string,
      summary: summary as string,
      risk_signals,
      principle_hint,
      bias_warning,
    });

    if (preFilterResult.violation) {
      // 저장 금지 + error_logs 기록 (Lock 6)
      try {
        await supabaseAdmin.from('error_logs').insert({
          type: 'legal_filter_violation',
          message: `Lock 6 위반: field='${preFilterResult.field}', pattern=${preFilterResult.pattern}`,
          stack: JSON.stringify({ briefing_date, source_channel }),
          user_id: null,
        });
      } catch (e) {
        console.error('error_logs insert failed:', e);
      }

      return new Response(
        JSON.stringify({
          error: 'Legal filter violation (Lock 6)',
          field: preFilterResult.field,
          hint: '매수/매도 추천, 목표가, 확정적 가격 예측 표현은 사용 불가합니다.',
        }),
        { status: 422, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // ── Step 4: 법적 후처리 필터 (사전과 동일 패턴 재적용 — 이중 안전장치) ──
    const postFilterResult = applyLegalFilter({
      brief_title: brief_title as string,
      summary: summary as string,
      risk_signals,
      principle_hint,
      bias_warning,
    });

    if (postFilterResult.violation) {
      return new Response(
        JSON.stringify({ error: 'Post-filter legal violation (Lock 6)' }),
        { status: 422, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // ── Step 5: 로그 기록 (생략 불가) ──
    try {
      await supabaseAdmin.from('ai_call_logs').insert({
        user_id: null,         // 어드민 호출 — user_id 없음
        function_name: FUNCTION_NAME,
        model: 'none',
        input_tokens: 0,
        output_tokens: 0,
        estimated_cost_usd: 0,
      });
    } catch (logError) {
      console.error('ai_call_logs insert failed:', logError);
    }

    // ── Step 6: daily_briefings upsert (Idempotency) ──
    const row = {
      briefing_date: briefing_date as string,
      source_channel: (source_channel as string).trim(),
      source_url,
      source_title,
      brief_title: (brief_title as string).trim(),
      summary: (summary as string).trim(),
      key_sectors,
      risk_signals,
      principle_hint,
      bias_warning,
      linked_principle_id,
      auto_approved,
      published_at: new Date().toISOString(),
    };

    const { data: upserted, error: upsertError } = await supabaseAdmin
      .from('daily_briefings')
      .upsert(row, { onConflict: 'briefing_date,source_channel' })
      .select()
      .single();

    if (upsertError) {
      throw upsertError;
    }

    console.log(
      `admin-briefing upserted: date=${briefing_date}, channel=${source_channel}, id=${upserted?.id}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        briefing: upserted,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('admin-briefing error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
