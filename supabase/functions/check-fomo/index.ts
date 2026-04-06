/**
 * check-fomo Edge Function
 * FOMO Threshold LOCK v1.0 — KOSPI ±2% + 거래량 +150% → 경보 발송
 *
 * 6-Step Pipeline:
 *   Step 1: 입력 검증 + Rate Limit
 *   Step 2: (PII 전처리 — 해당 없음, 시장 데이터 전용)
 *   Step 3: 공공데이터포털 KOSPI API 자동 조회 (파라미터 없을 때)
 *   Step 4: FOMO 경보 판정 (LOCK 임계값 기준)
 *   Step 5: 로그 기록 (ai_call_logs INSERT — 생략 불가)
 *   Step 6: DB upsert (fomo_alerts — Idempotency 필수)
 *
 * MVP: surge_standard / plunge_standard 2종만 구현.
 * elevated 타입 구현 금지 (Phase 2 이관 LOCKED).
 *
 * Trigger: pg_cron 장 마감 후 1회 (KST 16:00 = UTC 07:00) / 수동 호출
 *
 * 데이터 소스: 공공데이터포털 금융위원회 주식시세정보 API
 *   - 기본 URL: https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService/getStockPriceInfo
 *   - Secret: KRX_API_KEY (Supabase Secret에서만 읽음 — Lock 1)
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

// 공공데이터포털 KOSPI API 기본 URL
const KOSPI_API_BASE = 'https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService/getStockPriceInfo';

// ─── Step 3: 공공데이터포털 KOSPI 데이터 조회 ───

interface KOSPIApiItem {
  basDt: string;       // 기준일자 (YYYYMMDD)
  srtnCd: string;      // 단축코드
  isinCd: string;      // ISIN코드
  itmsNm: string;      // 종목명
  mrktCtg: string;     // 시장구분 (KOSPI/KOSDAQ)
  clpr: string;        // 종가
  vs: string;          // 대비 (전일 대비 가격 변화)
  fltRt: string;       // 등락률 (%)
  mkp: string;         // 시가
  hipr: string;        // 고가
  lopr: string;        // 저가
  trqu: string;        // 거래량
  trPrc: string;       // 거래대금
  lstgStCnt: string;   // 상장주식수
  mrktTotAmt: string;  // 시가총액
}

interface KOSPIApiResponse {
  response: {
    header: { resultCode: string; resultMsg: string };
    body: {
      items: { item: KOSPIApiItem[] | KOSPIApiItem };
      numOfRows: number;
      pageNo: number;
      totalCount: number;
    };
  };
}

interface MarketData {
  kospi_change_pct: number;
  volume_change_pct: number;
}

/**
 * 공공데이터포털 KOSPI 지수 조회
 * KOSPI 지수는 종목코드 없이 mrktCtg=KOSPI + numOfRows=21 조회
 * → 최신 1일 등락률 + 이전 20일 평균 거래량으로 volume_change_pct 계산
 */
async function fetchKOSPIData(apiKey: string): Promise<MarketData | null> {
  try {
    // 최근 21 거래일 데이터 조회 (오늘 1일 + 20일 이동평균용)
    const params = new URLSearchParams({
      serviceKey: apiKey,
      numOfRows: '21',
      pageNo: '1',
      resultType: 'json',
      mrktCls: 'KOSPI',    // KOSPI 시장
      itmsNm: 'KOSPI',     // 코스피 지수 종목명
    });

    const url = `${KOSPI_API_BASE}?${params.toString()}`;
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      console.error(`KOSPI API HTTP error: ${response.status}`);
      return null;
    }

    const data: KOSPIApiResponse = await response.json();

    const { resultCode, resultMsg } = data.response.header;
    if (resultCode !== '00') {
      console.error(`KOSPI API error: ${resultCode} ${resultMsg}`);
      return null;
    }

    const { items, totalCount } = data.response.body;
    if (!items || totalCount === 0) {
      console.error('KOSPI API returned no items');
      return null;
    }

    // 단일 결과도 배열로 정규화
    const itemList: KOSPIApiItem[] = Array.isArray(items.item)
      ? items.item
      : [items.item];

    if (itemList.length === 0) {
      console.error('KOSPI API: empty item list');
      return null;
    }

    // 최신 날짜 기준 정렬 (basDt 내림차순)
    itemList.sort((a, b) => b.basDt.localeCompare(a.basDt));

    // 당일 등락률
    const todayItem = itemList[0];
    const kospi_change_pct = parseFloat(todayItem.fltRt);

    if (isNaN(kospi_change_pct)) {
      console.error(`KOSPI API: invalid fltRt value: ${todayItem.fltRt}`);
      return null;
    }

    // 거래량 변화율 계산 (20일 이동평균 대비 오늘 %)
    const todayVolume = parseFloat(todayItem.trqu);
    let volume_change_pct = 0;

    if (itemList.length >= 2) {
      // 이전 최대 20일 거래량 평균
      const prevItems = itemList.slice(1, 21);
      const avgVolume =
        prevItems.reduce((sum, item) => sum + parseFloat(item.trqu), 0) /
        prevItems.length;

      if (avgVolume > 0) {
        // (오늘 거래량 / 20일 평균) * 100 — 100이 평균, 150이면 +50% 급증
        volume_change_pct = (todayVolume / avgVolume) * 100;
      }
    }

    console.log(
      `KOSPI: ${kospi_change_pct}% change, volume ratio: ${volume_change_pct.toFixed(1)}%`,
    );

    return { kospi_change_pct, volume_change_pct };
  } catch (err) {
    console.error('fetchKOSPIData error:', err);
    return null;
  }
}

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

    // Step 1: 입력 파싱 (body가 없거나 빈 경우 처리)
    let body: Record<string, unknown> = {};
    try {
      const text = await req.text();
      if (text.trim()) body = JSON.parse(text);
    } catch {
      // 빈 body 허용
    }

    const today = (body.date as string) || new Date().toISOString().split('T')[0];

    // Step 3: 시장 데이터 취득
    // 파라미터로 전달된 경우 (테스트/수동 호출): 그대로 사용
    // 파라미터 없는 경우: 공공데이터포털 KOSPI API 자동 조회
    let marketData: MarketData;

    if (body.kospi_change_pct != null && body.volume_change_pct != null) {
      // 수동 입력 모드 (테스트용)
      marketData = {
        kospi_change_pct: Number(body.kospi_change_pct),
        volume_change_pct: Number(body.volume_change_pct),
      };
      console.log('Using manual market data:', marketData);
    } else {
      // 자동 조회 모드 (pg_cron 자동 실행 시)
      const krxApiKey = Deno.env.get('KRX_API_KEY');
      if (!krxApiKey) {
        return new Response(
          JSON.stringify({ error: 'KRX_API_KEY secret not configured' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
      }

      const fetched = await fetchKOSPIData(krxApiKey);
      if (!fetched) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch KOSPI market data' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } },
        );
      }
      marketData = fetched;
    }

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
        market: marketData,
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

    // Step 6 (추가): Expo Push 알림 발송
    // Lock 1: Push 발송은 EF 내부에서만. 클라이언트 직접 발송 금지.
    try {
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('push_token')
        .eq('id', user.id)
        .single();

      if (userData?.push_token) {
        const pushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: userData.push_token,
            title: 'INVIT FOMO 경보',
            body: result.message!,
            channelId: 'fomo-alerts',
            data: {
              alert_type: result.alert_type,
              direction: result.direction,
            },
          }),
        });

        if (!pushResponse.ok) {
          console.error('Expo Push API error:', pushResponse.status);
        } else {
          console.log('Push notification sent to user:', user.id);
        }
      }
    } catch (pushErr) {
      // Push 실패가 경보 upsert 성공을 취소하지 않도록 catch
      console.error('Push notification failed (non-critical):', pushErr);
    }

    return new Response(JSON.stringify({
      success: true,
      triggered: true,
      alert_type: result.alert_type,
      direction: result.direction,
      message: result.message,
      market: marketData,
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
