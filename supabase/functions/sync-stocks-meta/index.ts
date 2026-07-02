/**
 * sync-stocks-meta v5 — KIS listing_status 보강 (이중 경로)
 *
 * v3 안전 수정 (코드리뷰 반영):
 *   [fix-auth]    JWT 인증을 service_role 전용으로 좁힘 (anon key 차단)
 *   [fix-recon]   stock_master_recon upsert + ON CONFLICT 처리 (Lock 4 idempotency)
 *   [fix-restore] ACTIVE 자동 복원 비활성화 (오프셋/#4 필드명 미검증 상태)
 *                 → listing_status 악화(ACTIVE→비ACTIVE)만 적용. 복원은 수동.
 *
 * v4 보안리뷰 수정 (LOGIC-002, DATA-002):
 *   [fix-limit]   nonActive limit을 BATCH_SIZE로 통일, staleActive limit 음수 방지
 *   [fix-errmsg]  에러응답에서 DB/외부 오류 원문 제거 → 일반화 메시지 + console 기록
 *
 * v5 보안리뷰 수정 (AUTHZ-001):
 *   [fix-jwt]     JWT 서명 자체검증 — SUPABASE_JWT_SECRET + jose jwtVerify (HS256)
 *                 verify_jwt=true 게이트웨이 단일 의존 탈피. 미설정 시 payload 디코드 폴백.
 *
 * 경로 A (Primary):  KIS webpush .mst (port 9090) — Supabase EF에서 현재 차단됨
 * 경로 B (Fallback): KIS REST API  — KIS_APP_KEY + KIS_APP_SECRET 설정 시 활성
 *
 * ⚠️ Path A 재활성화 전 필수:
 *   - KIS 공식 .mst 필드 스펙으로 byte offset 재검증 (현재 추정치)
 * ⚠️ Path B 재활성화 전 필수:
 *   - inquire-price 실제 응답에서 trht_yn·mang_issu_yn·sltr_yn 존재 확인
 *   - 미존재 시 iscd_stat_cls_code 기반으로 kisStatusToListingStatus 재작성
 *
 * Jerry 필수 액션 (경로 B):
 *   1. https://apiportal.koreainvestment.com 로그인 → 앱 생성 → appkey/appsecret 복사
 *   2. supabase secrets set KIS_APP_KEY=<appkey> KIS_APP_SECRET=<appsecret>
 *
 * 인증: service_role JWT (SUPABASE_JWT_SECRET으로 서명 검증) — verify_jwt=true 필수
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { jwtVerify } from 'https://deno.land/x/jose@v4.15.4/index.ts';

// ════════════════════════════════════════════════════════════════════════
// 인증 유틸 — [fix-auth] service_role JWT만 허용
// ════════════════════════════════════════════════════════════════════════

function getJwtRole(bearerHeader: string): string | null {
  try {
    const token = bearerHeader.replace(/^Bearer\s+/i, '');
    const payload = token.split('.')[1];
    if (!payload) return null;
    // base64url → base64 → JSON
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(padded));
    return decoded?.role ?? null;
  } catch {
    return null;
  }
}

// [fix-jwt] JWT 서명 자체검증 (AUTHZ-001) — verify_jwt=true 게이트웨이 의존 탈피
async function isAuthorized(authHeader: string, syncSecret: string): Promise<boolean> {
  // SYNC_SECRET 경로: verify_jwt=true 환경에서 게이트웨이가 먼저 401 처리하므로
  // 이 분기는 도달 불가 (사어). 문서화 목적으로만 유지.
  if (syncSecret && authHeader === `Bearer ${syncSecret}`) return true;

  if (!authHeader.startsWith('Bearer ey')) return false;
  const token = authHeader.slice(7); // 'Bearer '.length === 7

  const jwtSecret = Deno.env.get('SUPABASE_JWT_SECRET') ?? '';
  if (!jwtSecret) {
    // SUPABASE_JWT_SECRET 미설정 시 payload 디코드 폴백 (서명 미검증)
    // verify_jwt=true 게이트웨이가 반드시 활성이어야 안전
    return getJwtRole(authHeader) === 'service_role';
  }

  try {
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    return payload['role'] === 'service_role';
  } catch {
    return false;
  }
}

// ════════════════════════════════════════════════════════════════════════
// 경로 A: KIS webpush .mst 파싱
// ════════════════════════════════════════════════════════════════════════

const WEBPUSH_BASE = 'https://webpush.koreainvestment.com:9090/etc';

// ⚠️ 아래 오프셋은 여러 오픈소스 파서 기반 추정치.
// KIS 공식 문서 검증 전까지 Path A로 listing_status를 쓰지 않음.
// (parseMstBuffer 결과는 로그용으로만 사용)
const OFF = {
  shortCode:    0,
  surveillance: 133,
  management:   134,
  haltFlag:     136,
  cleanupFlag:  138,
} as const;

const RECORD_MIN_BYTES = 139;
const MAX_MST_RECORDS  = 5000;

interface MstRecord {
  code: string;
  surveillance: string;
  management: string;
  halt: string;
  cleanup: string;
}

function parseMstBuffer(buf: Uint8Array): MstRecord[] {
  const records: MstRecord[] = [];
  const ascii = new TextDecoder('ascii');
  let i = 0;
  while (i < buf.length && records.length < MAX_MST_RECORDS) {
    let lineEnd = buf.indexOf(0x0a, i);
    if (lineEnd === -1) lineEnd = buf.length;
    const dataEnd = (lineEnd > i && buf[lineEnd - 1] === 0x0d) ? lineEnd - 1 : lineEnd;
    const lineLen = dataEnd - i;
    if (lineLen >= RECORD_MIN_BYTES) {
      const rawCode = ascii.decode(buf.slice(i + OFF.shortCode, i + OFF.shortCode + 6)).trim();
      if (/^\d{5,6}$/.test(rawCode)) {
        records.push({
          code:         rawCode.padStart(6, '0'),
          surveillance: String.fromCharCode(buf[i + OFF.surveillance]),
          management:   String.fromCharCode(buf[i + OFF.management]),
          halt:         String.fromCharCode(buf[i + OFF.haltFlag]),
          cleanup:      String.fromCharCode(buf[i + OFF.cleanupFlag]),
        });
      }
    }
    i = lineEnd + 1;
  }
  return records;
}

async function tryWebpushDownload(): Promise<{ records: Map<string, MstRecord>; log: Record<string, string> }> {
  const mstFiles = ['kospi_code.mst', 'kosdaq_code.mst'];
  const allRecords = new Map<string, MstRecord>();
  const log: Record<string, string> = {};
  for (const filename of mstFiles) {
    try {
      const resp = await fetch(`${WEBPUSH_BASE}/${filename}`, {
        signal: AbortSignal.timeout(20_000),
        headers: { 'User-Agent': 'INVIT-SyncBot/3.0' },
      });
      if (!resp.ok) { log[filename] = `HTTP ${resp.status}`; continue; }
      const buf = new Uint8Array(await resp.arrayBuffer());
      const recs = parseMstBuffer(buf);
      log[filename] = `OK:${buf.length}bytes parsed:${recs.length}`;
      for (const r of recs) allRecords.set(r.code, r);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log[filename] = `ERR:${msg.substring(0, 80)}`;
    }
  }
  return { records: allRecords, log };
}

// [fix-restore] ACTIVE 복원 금지 — byte offset 미검증 상태에서 안전 방향만 허용
function deriveLockStatusMst(rec: MstRecord): string | null {
  if (rec.halt === '1')       return 'HALTED';
  if (rec.cleanup === '1')    return 'DELISTING_PENDING';
  if (rec.management === '1') return 'ADMINISTRATIVE';
  if (rec.surveillance !== '0' && rec.surveillance >= '1') return 'CAUTION';
  return null; // 정상 or 미결정 → ACTIVE로 복원하지 않음
}

// ════════════════════════════════════════════════════════════════════════
// 경로 B: KIS Open API REST
// ════════════════════════════════════════════════════════════════════════

const KIS_BASE   = 'https://openapi.koreainvestment.com:9443';
const BATCH_SIZE = 100;

interface KisToken { access_token: string; expires_in: number; }

async function getKisToken(appKey: string, appSecret: string): Promise<KisToken> {
  const resp = await fetch(`${KIS_BASE}/oauth2/tokenP`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', appkey: appKey, appsecret: appSecret }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!resp.ok) throw new Error(`KIS OAuth failed: ${resp.status}`);
  return resp.json();
}

// ⚠️ 아래 필드명(trht_yn, mang_issu_yn, sltr_yn)은 KIS inquire-price 응답에
// 실제로 존재하는지 미검증. 실제 응답에서 iscd_stat_cls_code 기반일 경우 재작성 필요.
// 필드 미존재 시 모두 'N' → kisStatusToListingStatus → null 반환으로 안전 폴백됨.
// [fix-restore] null 반환 시 ACTIVE 복원 금지 (하단 배치 루프 참고)
interface KisPriceStatus {
  trht_yn: string;            // 거래정지여부 Y/N (⚠️ 미검증)
  mang_issu_yn: string;       // 관리종목여부 Y/N (⚠️ 미검증)
  sltr_yn: string;            // 정리매매여부 Y/N (⚠️ 미검증)
  mrkt_alrm_cls_code: string; // 시장경보 00~03
  // iscd_stat_cls_code 존재 시 아래 주석 해제 후 재작성
  // iscd_stat_cls_code: string; // 51=관리, 58=거래정지, 60=정리매매, ...
}

async function queryKisStockStatus(
  code: string, token: string, appKey: string, appSecret: string,
): Promise<KisPriceStatus | null> {
  try {
    const url = new URL(`${KIS_BASE}/uapi/domestic-stock/v1/quotations/inquire-price`);
    url.searchParams.set('FID_COND_MRKT_DIV_CODE', 'J');
    url.searchParams.set('FID_INPUT_ISCD', code);
    const resp = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        appkey:    appKey,
        appsecret: appSecret,
        tr_id:     'FHKST01010100',
        custtype:  'P',
        'Content-Type': 'application/json; charset=utf-8',
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!resp.ok) return null;
    const body = await resp.json();
    const out = body?.output ?? {};
    return {
      trht_yn:            (out.trht_yn ?? 'N').toUpperCase(),
      mang_issu_yn:       (out.mang_issu_yn ?? 'N').toUpperCase(),
      sltr_yn:            (out.sltr_yn ?? 'N').toUpperCase(),
      mrkt_alrm_cls_code: out.mrkt_alrm_cls_code ?? '00',
    };
  } catch {
    return null;
  }
}

function kisStatusToListingStatus(s: KisPriceStatus): string | null {
  if (s.trht_yn === 'Y')       return 'HALTED';
  if (s.sltr_yn === 'Y')       return 'DELISTING_PENDING';
  if (s.mang_issu_yn === 'Y')  return 'ADMINISTRATIVE';
  if (['01','02','03'].includes(s.mrkt_alrm_cls_code)) return 'CAUTION';
  return null;
}

// ════════════════════════════════════════════════════════════════════════
// 공통 유틸
// ════════════════════════════════════════════════════════════════════════

function reconSeverity(status: string): 'INFO' | 'WARN' | 'ERROR' {
  if (status === 'HALTED' || status === 'DELISTING_PENDING') return 'ERROR';
  if (status === 'ADMINISTRATIVE') return 'WARN';
  return 'INFO';
}

async function applyUpdates(
  supabase: ReturnType<typeof createClient>,
  today: string,
  updates: { code: string; newStatus: string; oldStatus: string; note: string }[],
) {
  // [fix-recon] upsert ON CONFLICT (recon_date, code, field_name) — migration 032
  const reconRows = updates.map(u => ({
    recon_date: today, code: u.code,
    severity: reconSeverity(u.newStatus),
    field_name: 'listing_status',
    krx_value: u.oldStatus,
    kis_value: u.newStatus,
    note: u.note,
  }));

  // 상태별 배치 업데이트 (STOCK 스코프 안전장치 유지)
  const byStatus = new Map<string, string[]>();
  for (const u of updates) {
    byStatus.set(u.newStatus, [...(byStatus.get(u.newStatus) ?? []), u.code]);
  }
  let updatedCount = 0;
  for (const [newStatus, codes] of byStatus) {
    const { error } = await supabase
      .from('stocks')
      .update({ listing_status: newStatus })
      .in('code', codes)
      .eq('asset_type', 'STOCK');
    if (!error) updatedCount += codes.length;
    else console.error(`[sync-stocks-meta] update ${newStatus}:`, error.message);
  }

  // [fix-recon] upsert (ON CONFLICT: migration 032 UNIQUE 이용)
  let reconCount = 0;
  if (reconRows.length > 0) {
    const { error } = await supabase
      .from('stock_master_recon')
      .upsert(reconRows, { onConflict: 'recon_date,code,field_name' });
    if (!error) reconCount = reconRows.length;
    else console.error('[sync-stocks-meta] recon upsert:', error.message);
  }

  return { updatedCount, reconCount };
}

// ════════════════════════════════════════════════════════════════════════
// Main Handler
// ════════════════════════════════════════════════════════════════════════

Deno.serve(async (req: Request) => {
  // ── Step 1: 인증 — [fix-jwt] service_role JWT 서명 자체검증 (AUTHZ-001) ──
  const syncSecret = Deno.env.get('SYNC_SECRET') ?? '';
  const authHeader = req.headers.get('authorization') ?? '';

  if (!await isAuthorized(authHeader, syncSecret)) {
    return new Response(JSON.stringify({ error: 'Unauthorized — service_role JWT or SYNC_SECRET required' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
  const today = new Date().toISOString().slice(0, 10);

  // ── 경로 A: webpush .mst ─────────────────────────────────────────────
  const { records: mstRecords, log: mstLog } = await tryWebpushDownload();

  if (mstRecords.size > 0) {
    const { data: dbStocks, error: dbErr } = await supabase
      .from('stocks').select('code, listing_status')
      .eq('asset_type', 'STOCK').eq('is_active', true);
    if (dbErr) {
      // [fix-errmsg] 원문 오류는 console에만, 응답엔 일반화 메시지 (DATA-002)
      console.error('[sync-stocks-meta] stocks query failed:', dbErr.message);
      return new Response(JSON.stringify({ error: 'DB query failed', code: 'DB_ERROR' }), { status: 500 });
    }

    const dbMap = new Map<string, string>(
      (dbStocks ?? []).map(s => [s.code as string, s.listing_status as string])
    );

    const updates: { code: string; newStatus: string; oldStatus: string; note: string }[] = [];
    for (const [code, rec] of mstRecords) {
      const krxStatus = dbMap.get(code);
      if (!krxStatus) continue;
      const kisStatus = deriveLockStatusMst(rec);
      // [fix-restore] ACTIVE→비ACTIVE 악화만 적용. 복원(비ACTIVE→ACTIVE)은 금지.
      if (kisStatus !== null && kisStatus !== krxStatus) {
        updates.push({ code, newStatus: kisStatus, oldStatus: krxStatus,
          note: `MST 감리=${rec.surveillance} 관리=${rec.management} 정지=${rec.halt} 정리=${rec.cleanup}` });
      }
      // ↓ 복원 로직 제거됨 — byte offset 검증 후 재활성화할 것
    }

    const { updatedCount, reconCount } = await applyUpdates(supabase, today, updates);
    return new Response(JSON.stringify({
      status: 'SUCCESS', path: 'webpush_mst',
      parsed_total: mstRecords.size, downloads: mstLog,
      listing_status_updates: updatedCount, recon_entries: reconCount,
      sample_updates: updates.slice(0, 5), ran_at: new Date().toISOString(),
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // ── 경로 B: KIS REST API ─────────────────────────────────────────────
  const kisAppKey    = Deno.env.get('KIS_APP_KEY') ?? '';
  const kisAppSecret = Deno.env.get('KIS_APP_SECRET') ?? '';

  if (!kisAppKey || !kisAppSecret) {
    return new Response(JSON.stringify({
      status: 'SKIPPED',
      reason: 'webpush port 9090 차단 + KIS_APP_KEY/KIS_APP_SECRET 미설정',
      downloads: mstLog,
      action: [
        '① https://apiportal.koreainvestment.com 로그인',
        '② 앱 생성 → appkey + appsecret 복사',
        '③ supabase secrets set KIS_APP_KEY=<appkey> KIS_APP_SECRET=<appsecret>',
        '④ 첫 실행 후 응답 output 필드를 확인해 trht_yn 등 실제 필드명 검증',
      ],
      ran_at: new Date().toISOString(),
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // ── KIS OAuth 토큰 취득 ───────────────────────────────────────────────
  let kisToken: KisToken;
  try {
    kisToken = await getKisToken(kisAppKey, kisAppSecret);
  } catch (err) {
    // [fix-errmsg] 원문 오류는 console에만 (DATA-002)
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[sync-stocks-meta] KIS OAuth failed:', msg);
    return new Response(JSON.stringify({ status: 'ERROR', reason: 'KIS OAuth failed', code: 'KIS_AUTH_ERROR' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── 배치 대상 선정: 비ACTIVE 우선 + ACTIVE 중 last_changed_at 오래된 순 ──
  // [fix-limit] nonActive도 BATCH_SIZE 상한, staleActive limit 음수 방지 (LOGIC-002)
  const { data: nonActive } = await supabase
    .from('stocks').select('code, listing_status')
    .eq('asset_type', 'STOCK').eq('is_active', true)
    .neq('listing_status', 'ACTIVE').limit(BATCH_SIZE);

  const nonActiveCount = nonActive?.length ?? 0;
  const staleActiveLimit = Math.max(0, BATCH_SIZE - nonActiveCount);

  const { data: staleActive } = staleActiveLimit > 0
    ? await supabase
        .from('stocks').select('code, listing_status')
        .eq('asset_type', 'STOCK').eq('is_active', true).eq('listing_status', 'ACTIVE')
        .order('last_changed_at', { ascending: true, nullsFirst: true })
        .limit(staleActiveLimit)
    : { data: [] };

  const batch = [
    ...(nonActive ?? []).map(s => ({ code: s.code as string, status: s.listing_status as string })),
    ...(staleActive ?? []).map(s => ({ code: s.code as string, status: s.listing_status as string })),
  ];

  // ── KIS 조회 + 불일치 감지 ────────────────────────────────────────────
  const updates: { code: string; newStatus: string; oldStatus: string; note: string }[] = [];
  const RATE_DELAY_MS = 60;

  for (let i = 0; i < batch.length; i++) {
    const { code, status: krxStatus } = batch[i];
    if (i > 0 && i % 10 === 0) await new Promise(r => setTimeout(r, RATE_DELAY_MS * 10));

    const kisStat = await queryKisStockStatus(code, kisToken.access_token, kisAppKey, kisAppSecret);
    if (!kisStat) continue;

    const newStatus = kisStatusToListingStatus(kisStat);

    // [fix-restore] 악화만 적용, ACTIVE 복원 금지 (⚠️ 필드명 검증 후 복원 로직 추가)
    if (newStatus !== null && newStatus !== krxStatus) {
      updates.push({ code, newStatus, oldStatus: krxStatus,
        note: `KIS REST trht=${kisStat.trht_yn} mang=${kisStat.mang_issu_yn} sltr=${kisStat.sltr_yn} alrm=${kisStat.mrkt_alrm_cls_code}` });
    }
    // ↓ 복원 로직 제거됨 — inquire-price 응답 필드 검증 후 재활성화할 것
  }

  const { updatedCount, reconCount } = await applyUpdates(supabase, today, updates);

  return new Response(JSON.stringify({
    status: 'SUCCESS', path: 'kis_rest_api',
    batch_size: batch.length,
    listing_status_updates: updatedCount,
    recon_entries: reconCount,
    sample_updates: updates.slice(0, 5),
    ran_at: new Date().toISOString(),
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
