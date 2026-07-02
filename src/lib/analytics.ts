/**
 * analytics.ts — 경량 이벤트 계측 라이브러리
 * G4: 런칭 코호트 퍼널 데이터 수집
 *
 * Lock 1: 이벤트 전송은 log-events EF 경유
 * Lock 7: props에 PII 절대 포함 금지 (email, 실명, 종목+수익률 조합)
 *
 * 핵심 이벤트 (최소 퍼널):
 *   onboarding_started    — BiasAssessmentScreen 진입
 *   onboarding_completed  — AssessmentResultScreen 도달
 *   journal_saved         — J01 저장 성공
 *   coaching_viewed       — 코칭 결과 모달 표시
 *   paywall_viewed        — SubscriptionScreen 진입
 */

import { supabase } from './supabase';

interface AnalyticsEvent {
  event_name: string;
  props: Record<string, unknown>;
  client_ts: string;
}

let queue: AnalyticsEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(flush, 2500); // 2.5초 배치
}

async function flush() {
  flushTimer = null;
  if (queue.length === 0) return;
  const batch = queue.splice(0, queue.length);
  try {
    await supabase.functions.invoke('log-events', { body: { events: batch } });
  } catch (e) {
    // 분석 실패는 사용자 경험에 영향 없음 — 조용히 드롭
    console.warn('[analytics] flush failed (non-fatal):', e);
  }
}

/**
 * 이벤트 기록. props에 PII(이메일/실명/종목+수익률) 절대 포함 금지.
 * 비동기 배치 전송 — UI를 블록하지 않음.
 */
export function track(event_name: string, props: Record<string, unknown> = {}): void {
  queue.push({ event_name, props, client_ts: new Date().toISOString() });
  scheduleFlush();
}

/** 앱 종료/백그라운드 전환 시 즉시 플러시 */
export function flushNow(): void {
  flush();
}

export const Analytics = { track, flushNow };
