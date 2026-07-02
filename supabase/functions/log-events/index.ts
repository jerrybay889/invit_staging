/**
 * log-events Edge Function
 * 클라이언트 분석 이벤트 배치 수신 → analytics_events 테이블 INSERT
 * G4: 런칭 코호트 계측 (첫 코호트 퍼널 데이터 확보)
 *
 * Lock 3: analytics_events = Operational 계층 — service_role 전용 INSERT
 * Lock 7: props에서 PII 자동 제거 (email, phone, account)
 *
 * 배포: supabase functions deploy log-events
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CORS_HEADERS } from '../_shared/auth.ts';

// PII-001 — 필드명 블랙리스트 + 값 스크럽(이메일/전화/장수 숫자) + 크기 상한.
const PII_PROP_KEYS = new Set(['email', 'phone', 'name', 'display_name', 'account', 'ticker_with_pnl']);
const MAX_PROPS_BYTES = 4000;

function scrubValue(v: unknown): unknown {
  if (typeof v === 'string') {
    return v
      .replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL]')
      .replace(/\d{2,3}-\d{3,4}-\d{4}/g, '[PHONE]')
      .replace(/\d{10,}/g, '[NUM]')
      .slice(0, 500);
  }
  if (Array.isArray(v)) return v.slice(0, 50).map(scrubValue);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (PII_PROP_KEYS.has(k.toLowerCase())) continue;  // PII 키 제거(중첩 포함)
      out[k] = scrubValue(val);
    }
    return out;
  }
  return v;
}

function sanitizeProps(props: Record<string, unknown>): Record<string, unknown> {
  const safe = scrubValue(props) as Record<string, unknown>;
  // 과대 props 저장 남용 방지 — 크기 상한 초과 시 폐기
  if (JSON.stringify(safe).length > MAX_PROPS_BYTES) {
    return { _truncated: true };
  }
  return safe;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 본인 확인
    const supabaseAnon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    let body: { events?: unknown[] } = {};
    try { body = await req.json(); } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    if (!Array.isArray(body.events) || body.events.length === 0) {
      return new Response(JSON.stringify({ inserted: 0 }), {
        status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // 최대 50개/배치 (과도한 이벤트 방어)
    const batch = body.events.slice(0, 50);

    const rows = batch
      .filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
      .filter((e) => typeof e['event_name'] === 'string' && e['event_name'].length > 0)
      .map((e) => ({
        user_id: user.id,
        event_name: String(e['event_name']).slice(0, 100),
        props: sanitizeProps((e['props'] as Record<string, unknown>) ?? {}),
        client_ts: typeof e['client_ts'] === 'string' ? e['client_ts'] : null,
      }));

    if (rows.length === 0) {
      return new Response(JSON.stringify({ inserted: 0 }), {
        status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const { error: insertError } = await supabaseAdmin
      .from('analytics_events')
      .insert(rows);

    if (insertError) {
      console.error('analytics_events insert failed:', insertError);
      throw insertError;
    }

    return new Response(JSON.stringify({ success: true, inserted: rows.length }), {
      status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('log-events error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
