/**
 * _shared/auth.ts — Edge Function 인증/CORS SSOT (AUTHZ-001)
 *
 * 핵심 원칙: isServiceRoleJwt는 서명검증을 하지 않으므로 게이트웨이 verify_jwt=true 전제에서만 신뢰.
 * 관리/크론 EF는 절대 `--no-verify-jwt`로 배포 금지. 보조 시크릿은 safeEqual로 constant-time 비교.
 */

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*', // 모바일 전용. web 출시 시 화이트리스트로 교체(HARDENING-002).
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-secret',
};

/** 상수 시간 문자열 비교 (timing attack 완화). */
export function safeEqual(a: string, b: string): boolean {
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
 * (서명검증 미수행 — verify_jwt=true 없이는 신뢰 불가. AUTHZ-001.)
 */
export function isServiceRoleJwt(authHeader: string): boolean {
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload?.role === 'service_role';
  } catch {
    return false;
  }
}

/** 관리/크론 EF 인증: service_role JWT(게이트웨이 검증됨) 또는 x-admin-secret(constant-time). */
export function isAdminAuthorized(req: Request): boolean {
  const authHeader = req.headers.get('Authorization') ?? '';
  const syncSecret = Deno.env.get('SYNC_SECRET');
  const providedSecret = req.headers.get('x-admin-secret');
  return (
    isServiceRoleJwt(authHeader) ||
    (!!syncSecret && !!providedSecret && safeEqual(providedSecret, syncSecret))
  );
}
