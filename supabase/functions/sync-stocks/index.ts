/**
 * sync-stocks v13 — KRX 전종목 델타 동기화 (Phase B1: ETF/ETN 자동 분류)
 *
 * 데이터 소스:
 *   주식: GetKrxListedInfoService/getItemInfo (KRX_API_KEY)
 *   ETF:  GetSecuritiesProductInfoService/getETFPriceInfo (DATAGO_ETF_ETN_KEY)
 *   ETN:  GetSecuritiesProductInfoService/getETNPriceInfo (DATAGO_ETF_ETN_KEY)
 *
 * Phase A+ 핫픽스: INACTIVATE는 각 asset_type 내에서만 스코프
 *   - 주식 피드는 STOCK만, ETF 피드는 ETF만, ETN 피드는 ETN만 INACTIVATE 가능
 *
 * Circuit Breaker: STOCK=90%, ETF/ETN=80%
 *
 * 인증: verify_jwt=true. service_role JWT 또는 SYNC_SECRET 헤더.
 * ⚠️ 절대 --no-verify-jwt 배포 금지 (AUTHZ-001)
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SECURITIES_API_BASE =
  'https://apis.data.go.kr/1160100/service/GetSecuritiesProductInfoService';
const STOCK_API_URL =
  'https://apis.data.go.kr/1160100/service/GetKrxListedInfoService/getItemInfo';

const PAGE_SIZE = 1000;
const MAX_PAGES = 12;
const UPSERT_BATCH = 500;

// ─── 타입 ──────────────────────────────────────────────────────────────────────

interface AnyApiItem {
  basDt?: string;
  srtnCd?: string;
  isinCd?: string;
  itmsNm?: string;
  mrktCtg?: string;
  lstgStCnt?: string; // ETF 상장좌수
  rdmpEndDt?: string; // ETN 상환종료일 yyyymmdd
}

interface ApiResponse {
  response: {
    header: { resultCode: string; resultMsg: string };
    body: {
      items: { item: AnyApiItem[] | AnyApiItem } | '';
      numOfRows: number;
      pageNo: number;
      totalCount: number;
    };
  };
}

interface IncomingRow {
  code: string;
  name: string;
  market: string;
  isin: string | null;
  row_hash: string;
  listing_shares: number | null;
  maturity_date: string | null;
}

interface CurrentRow {
  code: string;
  name: string;
  market: string;
  isin: string | null;
  listing_status: string;
  is_active: boolean;
  row_hash: string | null;
  asset_type: string;
}

interface SyncResult {
  inserted: number;
  updated: number;
  reactivated: number;
  inactivated: number;
  unchanged: number;
  total_fetched: number;
  aborted: boolean;
  anomaly_note?: string;
}

interface PageResult {
  ok: boolean;
  items: AnyApiItem[];
  totalCount: number;
  diag: string;
}

// ─── ETF/ETN 분류 헬퍼 ─────────────────────────────────────────────────────────

function classifyProductSubtype(name: string): string {
  // 3X 레버리지 (3배 명시 — 2X 체크보다 먼저)
  if (/3[Xx]레버리지|레버리지.*3[Xx]|3배레버리지|레버리지.*3배|3배.*레버리지/.test(name)) return 'LEVERAGE_3X';
  // 2X 레버리지 (or 레버리지 일반)
  if (/레버리지/i.test(name)) return 'LEVERAGE_2X';
  // 인버스 2X (2X 체크 먼저)
  if (/인버스.*2[Xx]|인버스.*2배|더블인버스|2[Xx].*인버스/.test(name)) return 'INVERSE_2X';
  // 인버스 1X
  if (/인버스/i.test(name)) return 'INVERSE_1X';
  // 액티브 운용
  if (/액티브/i.test(name)) return 'ACTIVE_MGMT';
  // 테마
  if (/테마/i.test(name)) return 'THEMED';
  return 'VANILLA';
}

const ETF_ISSUER_MAP: [RegExp, string][] = [
  [/^KODEX/i,     '삼성자산운용'],
  [/^TIGER/i,     '미래에셋자산운용'],
  [/^ACE/i,       '한국투자신탁운용'],
  [/^KINDEX/i,    '한국투자신탁운용'],
  [/^KBSTAR/i,    'KB자산운용'],
  [/^RISE/i,      'KB자산운용'],
  [/^HANARO/i,    'NH아문디자산운용'],
  [/^ARIRANG/i,   '한화자산운용'],
  [/^PLUS/i,      '한화자산운용'],
  [/^KOSEF/i,     '키움투자자산운용'],
  [/^SOL/i,       '신한자산운용'],
  [/^TIMEFOLIO/i, '타임폴리오자산운용'],
  [/^WOORI/i,     '우리자산운용'],
  [/^MAXIS/i,     '미래에셋자산운용'],
  [/^TREX/i,      '유진투자증권'],
  [/^FOCUS/i,     '교보악사자산운용'],
  [/^BNK/i,       'BNK자산운용'],
];

const ETN_ISSUER_MAP: [RegExp, string][] = [
  [/^삼성/,   '삼성증권'],
  [/^NH/i,    'NH투자증권'],
  [/^한국투자/, '한국투자증권'],
  [/^KIS/i,   '한국투자증권'],
  [/^미래에셋/, '미래에셋증권'],
  [/^KB/i,    'KB증권'],
  [/^신한/,   '신한투자증권'],
  [/^키움/,   '키움증권'],
  [/^대신/,   '대신증권'],
  [/^교보/,   '교보증권'],
  [/^하나/,   '하나증권'],
  [/^메리츠/, '메리츠증권'],
  [/^유안타/, '유안타증권'],
  [/^현대차/, '현대차증권'],
  [/^SK/i,    'SK증권'],
];

function extractIssuer(name: string, assetType: 'ETF' | 'ETN' | 'STOCK'): string | null {
  const map = assetType === 'ETF' ? ETF_ISSUER_MAP : assetType === 'ETN' ? ETN_ISSUER_MAP : [];
  for (const [pattern, issuer] of map) {
    if (pattern.test(name)) return issuer;
  }
  return null;
}

// ─── 유틸 ──────────────────────────────────────────────────────────────────────

function sanitizeCode(srtnCd: string | undefined): string | null {
  if (!srtnCd) return null;
  const digits = srtnCd.replace(/\D/g, '');
  if (digits.length < 6) return null;
  return digits.slice(-6);
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function buildHashInput(name: string, market: string, isin: string | null, assetType: string): string {
  return `${name}|${market}|${isin ?? ''}|${assetType}|ACTIVE`;
}

function parseDateStr(yyyymmdd: string | undefined | null): string | null {
  if (!yyyymmdd || yyyymmdd.length < 8) return null;
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ba = enc.encode(a);
  const bb = enc.encode(b);
  if (ba.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ba.length; i++) diff |= ba[i] ^ bb[i];
  return diff === 0;
}

function isServiceRoleJwt(authHeader: string): boolean {
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json)?.role === 'service_role';
  } catch {
    return false;
  }
}

// ─── API 호출 ──────────────────────────────────────────────────────────────────

let rawKeyMode: boolean | null = null;

async function fetchPage(apiUrl: string, apiKey: string, basDt: string, pageNo: number): Promise<PageResult> {
  const tryOnce = async (raw: boolean): Promise<PageResult> => {
    const urlStr = raw
      ? `${apiUrl}?serviceKey=${apiKey}&numOfRows=${PAGE_SIZE}&pageNo=${pageNo}&resultType=json&basDt=${basDt}`
      : `${apiUrl}?${new URLSearchParams({ serviceKey: apiKey, numOfRows: String(PAGE_SIZE), pageNo: String(pageNo), resultType: 'json', basDt }).toString()}`;

    let resp: Response;
    try {
      resp = await fetch(urlStr, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/json',
        },
      });
    } catch (e) {
      return { ok: false, items: [], totalCount: 0, diag: `fetch failed: ${e instanceof Error ? e.message : String(e)}` };
    }
    const text = await resp.text();
    if (!resp.ok) return { ok: false, items: [], totalCount: 0, diag: `HTTP ${resp.status}: ${text.slice(0, 180)}` };
    let data: ApiResponse;
    try { data = JSON.parse(text); }
    catch { return { ok: false, items: [], totalCount: 0, diag: `non-JSON: ${text.slice(0, 180)}` }; }
    const rc = data.response?.header?.resultCode;
    if (rc !== '00') return { ok: false, items: [], totalCount: 0, diag: `resultCode ${rc}: ${data.response?.header?.resultMsg}` };
    const body = data.response.body;
    const totalCount = Number(body.totalCount) || 0;
    if (!body.items || body.items === '' || totalCount === 0) return { ok: true, items: [], totalCount, diag: 'empty(holiday)' };
    const itemList = Array.isArray(body.items.item) ? body.items.item : [body.items.item];
    return { ok: true, items: itemList, totalCount, diag: 'ok' };
  };

  const modes = rawKeyMode === null ? [false, true] : [rawKeyMode];
  let last: PageResult = { ok: false, items: [], totalCount: 0, diag: 'no attempt' };
  for (const raw of modes) {
    last = await tryOnce(raw);
    if (last.ok) { rawKeyMode = raw; return last; }
  }
  return last;
}

async function findLatestBusinessDay(apiKey: string): Promise<{ basDt: string | null; diag: string }> {
  const now = new Date();
  let lastDiag = 'no attempt';
  for (let i = 0; i < 10; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const basDt = d.toISOString().split('T')[0].replace(/-/g, '');
    const page = await fetchPage(STOCK_API_URL, apiKey, basDt, 1);
    lastDiag = `${basDt} → ${page.diag}`;
    if (page.ok && page.totalCount > 0) return { basDt, diag: page.diag };
    if (!page.ok) break;
  }
  return { basDt: null, diag: lastDiag };
}

// ─── 자산 유형별 동기화 파이프라인 ────────────────────────────────────────────

async function syncAssets(params: {
  supabaseAdmin: SupabaseClient;
  assetType: 'STOCK' | 'ETF' | 'ETN';
  legacyType: string;
  sourceSystem: string;
  apiUrl: string;
  apiKey: string;
  basDt: string;
  sourceAsOfDate: string;
  circuitBreakerRatio: number;
  nowIso: string;
  today: string;
}): Promise<SyncResult & { runId: number | null }> {
  const {
    supabaseAdmin, assetType, legacyType, sourceSystem,
    apiUrl, apiKey, basDt, sourceAsOfDate,
    circuitBreakerRatio, nowIso, today,
  } = params;

  // sync_runs RUNNING 행
  const { data: runRow, error: runErr } = await supabaseAdmin
    .from('stock_sync_runs')
    .insert({ source_system: sourceSystem, status: 'RUNNING', started_at: nowIso })
    .select('run_id').single();
  if (runErr) console.error('sync_runs insert failed (non-fatal):', runErr);
  const runId: number | null = runRow?.run_id ?? null;

  const finalize = async (status: 'SUCCESS' | 'ABORTED', extra: Record<string, unknown> = {}) => {
    if (!runId) return;
    try {
      await supabaseAdmin
        .from('stock_sync_runs')
        .update({ status, finished_at: new Date().toISOString(), ...extra })
        .eq('run_id', runId);
    } catch (e) { console.error('finalizeRun failed:', e); }
  };

  try {
    // ── 수집 ──
    const incoming = new Map<string, IncomingRow>();
    let totalFetched = 0;

    for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo++) {
      const page = await fetchPage(apiUrl, apiKey, basDt, pageNo);
      if (!page.ok) break;
      for (const item of page.items) {
        const code = sanitizeCode(item.srtnCd);
        if (!code || !item.itmsNm) continue;
        const name = item.itmsNm.trim();
        const market = (item.mrktCtg || assetType).toUpperCase();
        const isin = item.isinCd?.trim() || null;
        const row_hash = await sha256(buildHashInput(name, market, isin, assetType));
        const listing_shares = item.lstgStCnt ? (parseInt(item.lstgStCnt, 10) || null) : null;
        const maturity_date = parseDateStr(item.rdmpEndDt);
        incoming.set(code, { code, name, market, isin, row_hash, listing_shares, maturity_date });
      }
      totalFetched += page.items.length;
      if (totalFetched >= page.totalCount || page.items.length === 0) break;
    }

    // 빈 응답 = 공휴일 또는 API 오류 — ABORTED (정상 처리)
    if (incoming.size === 0) {
      await finalize('ABORTED', {
        total_fetched: totalFetched,
        anomaly_note: `No items from ${sourceSystem} (holiday or API error)`,
      });
      return { inserted: 0, updated: 0, reactivated: 0, inactivated: 0, unchanged: 0, total_fetched: totalFetched, runId, aborted: true, anomaly_note: 'empty' };
    }

    // ── Circuit Breaker (asset_type 스코프) ──
    const { count: activeCount } = await supabaseAdmin
      .from('stocks')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('asset_type', assetType);
    const currentActiveCount = activeCount ?? 0;

    if (currentActiveCount > 0 && incoming.size < currentActiveCount * circuitBreakerRatio) {
      const note = `Circuit breaker (${assetType}): incoming=${incoming.size} < active=${currentActiveCount} × ${circuitBreakerRatio}`;
      await finalize('ABORTED', { total_fetched: totalFetched, anomaly_note: note });
      return { inserted: 0, updated: 0, reactivated: 0, inactivated: 0, unchanged: 0, total_fetched: totalFetched, runId, aborted: true, anomaly_note: note };
    }

    // ── 현재 해당 asset_type 행 로드 (페이지네이션) ──
    const allCurrentRows: CurrentRow[] = [];
    const FETCH_BATCH = 1000;
    for (let from = 0; ; from += FETCH_BATCH) {
      const { data, error } = await supabaseAdmin
        .from('stocks')
        .select('code, name, market, isin, listing_status, is_active, row_hash, asset_type')
        .eq('asset_type', assetType)
        .range(from, from + FETCH_BATCH - 1);
      if (error) throw new Error(`stocks load failed: ${error.message}`);
      if (!data || data.length === 0) break;
      allCurrentRows.push(...(data as CurrentRow[]));
      if (data.length < FETCH_BATCH) break;
    }
    const currentMap = new Map<string, CurrentRow>(allCurrentRows.map(r => [r.code, r]));

    // ── 델타 산출 ──
    const toInsert: object[] = [];
    const toUpdate: object[] = [];
    const toReactivate: string[] = [];
    const toInactivate: string[] = [];
    const changeLogs: object[] = [];

    for (const [code, inc] of incoming.entries()) {
      const cur = currentMap.get(code);
      if (!cur) {
        // INSERT — 신규
        const row: Record<string, unknown> = {
          code: inc.code, name: inc.name, market: inc.market, isin: inc.isin,
          type: legacyType, asset_type: assetType,
          is_active: true, listing_status: 'ACTIVE',
          search_enabled: true, recommendation_enabled: true,
          row_hash: inc.row_hash, source_system: sourceSystem,
          source_as_of_date: sourceAsOfDate,
          first_seen_at: nowIso, last_changed_at: nowIso, updated_at: nowIso,
        };
        if (assetType !== 'STOCK') {
          row.product_subtype = classifyProductSubtype(inc.name);
          const iss = extractIssuer(inc.name, assetType);
          if (iss) row.issuer = iss;
        }
        if (inc.listing_shares != null) row.listing_shares = inc.listing_shares;
        if (inc.maturity_date != null) row.maturity_date = inc.maturity_date;
        toInsert.push(row);
        changeLogs.push({ change_date: today, code, change_type: 'INSERT', before_hash: null, after_hash: inc.row_hash, source_as_of_date: sourceAsOfDate });
      } else if (!cur.is_active) {
        // REACTIVATE
        toReactivate.push(code);
        changeLogs.push({ change_date: today, code, change_type: 'REACTIVATE', before_hash: cur.row_hash, after_hash: inc.row_hash, source_as_of_date: sourceAsOfDate });
      } else if (cur.row_hash !== inc.row_hash) {
        // UPDATE
        const upd: Record<string, unknown> = {
          code, name: inc.name, market: inc.market, isin: inc.isin,
          row_hash: inc.row_hash, source_as_of_date: sourceAsOfDate,
          last_changed_at: nowIso, updated_at: nowIso,
        };
        if (assetType !== 'STOCK') {
          upd.product_subtype = classifyProductSubtype(inc.name);
          const iss = extractIssuer(inc.name, assetType);
          if (iss) upd.issuer = iss;
        }
        if (inc.listing_shares != null) upd.listing_shares = inc.listing_shares;
        if (inc.maturity_date != null) upd.maturity_date = inc.maturity_date;
        const changedCols: Record<string, { before: unknown; after: unknown }> = {};
        if (cur.name !== inc.name) changedCols.name = { before: cur.name, after: inc.name };
        if (cur.market !== inc.market) changedCols.market = { before: cur.market, after: inc.market };
        if ((cur.isin ?? null) !== inc.isin) changedCols.isin = { before: cur.isin, after: inc.isin };
        toUpdate.push(upd);
        changeLogs.push({ change_date: today, code, change_type: 'UPDATE', changed_columns: changedCols, before_hash: cur.row_hash, after_hash: inc.row_hash, source_as_of_date: sourceAsOfDate });
      }
      // else: unchanged
    }

    // INACTIVATE — 이 asset_type 내에서만 스코프
    for (const [code, cur] of currentMap.entries()) {
      if (cur.is_active && !incoming.has(code)) {
        toInactivate.push(code);
        changeLogs.push({ change_date: today, code, change_type: 'INACTIVATE', before_hash: cur.row_hash, after_hash: null, source_as_of_date: sourceAsOfDate });
      }
    }

    const unchanged = incoming.size - toInsert.length - toUpdate.length - toReactivate.length;

    // ── DB 쓰기 ──
    for (let i = 0; i < toInsert.length; i += UPSERT_BATCH) {
      const { error } = await supabaseAdmin.from('stocks').insert(toInsert.slice(i, i + UPSERT_BATCH));
      if (error) throw new Error(`INSERT batch failed (${assetType}): ${error.message}`);
    }
    for (let i = 0; i < toUpdate.length; i += UPSERT_BATCH) {
      const { error } = await supabaseAdmin.from('stocks').upsert(toUpdate.slice(i, i + UPSERT_BATCH), { onConflict: 'code' });
      if (error) throw new Error(`UPDATE batch failed (${assetType}): ${error.message}`);
    }
    if (toReactivate.length > 0) {
      const { error } = await supabaseAdmin.from('stocks')
        .update({ is_active: true, listing_status: 'ACTIVE', delisted_at: null, last_changed_at: nowIso, updated_at: nowIso })
        .in('code', toReactivate);
      if (error) throw new Error(`REACTIVATE failed (${assetType}): ${error.message}`);
    }
    if (toInactivate.length > 0) {
      const { error } = await supabaseAdmin.from('stocks')
        .update({ is_active: false, listing_status: 'DELISTED', search_enabled: false, recommendation_enabled: false, delisted_at: nowIso, last_changed_at: nowIso, updated_at: nowIso })
        .in('code', toInactivate);
      if (error) throw new Error(`INACTIVATE failed (${assetType}): ${error.message}`);
    }
    for (let i = 0; i < changeLogs.length; i += UPSERT_BATCH) {
      const { error } = await supabaseAdmin.from('stock_change_log').insert(changeLogs.slice(i, i + UPSERT_BATCH));
      if (error) console.error('change_log insert failed (non-fatal):', error);
    }

    const result: SyncResult = {
      inserted: toInsert.length, updated: toUpdate.length, reactivated: toReactivate.length,
      inactivated: toInactivate.length, unchanged, total_fetched: totalFetched, aborted: false,
    };
    await finalize('SUCCESS', {
      as_of_date: sourceAsOfDate, total_fetched: totalFetched,
      inserted: toInsert.length, updated: toUpdate.length + toReactivate.length,
      inactivated: toInactivate.length, unchanged,
    });
    return { ...result, runId };

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await finalize('ABORTED', { anomaly_note: message });
    throw err;
  }
}

// ─── 메인 ──────────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  const nowIso = new Date().toISOString();
  const today = nowIso.split('T')[0];

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    // ── 인증 ──
    const authHeader = req.headers.get('Authorization') ?? '';
    const syncSecret = Deno.env.get('SYNC_SECRET');
    const providedSecret = req.headers.get('x-admin-secret');
    const authorized =
      isServiceRoleJwt(authHeader) ||
      (!!syncSecret && !!providedSecret && safeEqual(providedSecret, syncSecret));
    if (!authorized) {
      return new Response(JSON.stringify({ error: 'Forbidden — admin only' }), {
        status: 403, headers: { 'Content-Type': 'application/json' },
      });
    }

    const krxApiKey = Deno.env.get('KRX_API_KEY');
    if (!krxApiKey) {
      return new Response(JSON.stringify({ error: 'KRX_API_KEY secret not configured' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }
    const etfEtnApiKey = Deno.env.get('DATAGO_ETF_ETN_KEY');

    // ── 최근 영업일 탐색 (주식 피드 기준) ──
    const { basDt, diag } = await findLatestBusinessDay(krxApiKey);
    if (!basDt) {
      return new Response(JSON.stringify({ error: 'No business day / KRX API error', diag }), {
        status: 503, headers: { 'Content-Type': 'application/json' },
      });
    }
    const sourceAsOfDate = `${basDt.slice(0, 4)}-${basDt.slice(4, 6)}-${basDt.slice(6, 8)}`;
    const shared = { supabaseAdmin, basDt, sourceAsOfDate, nowIso, today };

    // ── 1. 주식 동기화 ──
    const stockResult = await syncAssets({
      ...shared,
      assetType: 'STOCK', legacyType: 'stock',
      sourceSystem: 'KRX_DATAGO',
      apiUrl: STOCK_API_URL,
      apiKey: krxApiKey,
      circuitBreakerRatio: 0.9,
    });

    let etfResult: (SyncResult & { runId: number | null }) | null = null;
    let etnResult: (SyncResult & { runId: number | null }) | null = null;

    // ── 2. ETF/ETN 동기화 (키 있을 때만) ──
    if (etfEtnApiKey) {
      etfResult = await syncAssets({
        ...shared,
        assetType: 'ETF', legacyType: 'etf',
        sourceSystem: 'KRX_DATAGO_ETF',
        apiUrl: `${SECURITIES_API_BASE}/getETFPriceInfo`,
        apiKey: etfEtnApiKey,
        circuitBreakerRatio: 0.8,
      });

      etnResult = await syncAssets({
        ...shared,
        assetType: 'ETN', legacyType: 'etn',
        sourceSystem: 'KRX_DATAGO_ETN',
        apiUrl: `${SECURITIES_API_BASE}/getETNPriceInfo`,
        apiKey: etfEtnApiKey,
        circuitBreakerRatio: 0.8,
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const stripRunId = <T extends { runId: unknown }>(r: T | null) => {
      if (!r) return null;
      const { runId: _rid, ...rest } = r;
      return rest;
    };

    return new Response(JSON.stringify({
      success: true,
      basDt,
      stock: stripRunId(stockResult),
      etf: stripRunId(etfResult),
      etn: stripRunId(etnResult),
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
});
