/**
 * delete-account Edge Function
 * 회원 탈퇴: PII 익명화 + Supabase Auth 사용자 삭제
 * Google Play 정책(2024~) + App Store 5.1.1 — 계정생성 앱 필수 요건
 *
 * Lock 3: service_role 전용 DB 쓰기
 * Lock 7: 삭제 시 PII 익명화 (display_name, push_token, consent)
 *
 * 인증: 사용자 본인 Bearer JWT (service_role 아님 — 본인 확인용)
 * 안전장치: body.confirm === 'DELETE' 필수
 *
 * 배포: supabase functions deploy delete-account
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CORS_HEADERS } from '../_shared/auth.ts';

const FUNCTION_NAME = 'delete-account';

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

    // 본인 확인 (anon client + JWT)
    const supabaseAnon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // 명시적 확인 필드 검증 (오삭제 방지)
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* ok */ }

    if (body.confirm !== 'DELETE') {
      return new Response(JSON.stringify({ error: 'confirm 필드에 "DELETE"를 입력해주세요' }), {
        status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;
    const now = new Date().toISOString();

    // PRIV-001 — users→자식 테이블이 ON DELETE CASCADE라 auth.users 삭제 시 전 데이터가 제거된다.
    // 다만 auth 삭제가 부분 실패할 경우를 대비해 자유텍스트 PII(trade_rationale/태그)를 선제 익명화한다.
    await Promise.allSettled([
      supabaseAdmin
        .from('investment_journals')
        .update({ trade_rationale: null, trade_reason_tags: null })
        .eq('user_id', userId),
    ]);

    // Lock 7 — users 프로필 PII 익명화
    await supabaseAdmin
      .from('users')
      .update({
        display_name: null,
        push_token: null,
        consent: null,
        status: 'deleted',
        updated_at: now,
      })
      .eq('id', userId);

    // Supabase Auth 사용자 삭제 (이 시점 이후 JWT 무효)
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      console.error('auth.admin.deleteUser failed:', deleteAuthError);
      throw deleteAuthError;
    }

    // 감사 로그 (Operational — user_id null: 이미 삭제됨)
    try {
      await supabaseAdmin.from('ai_call_logs').insert({
        user_id: null,
        function_name: FUNCTION_NAME,
        model: 'none',
        input_tokens: 0,
        output_tokens: 0,
        estimated_cost_usd: 0,
      });
    } catch {
      // 로그 실패는 삭제 성공에 영향 없음
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('delete-account error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
