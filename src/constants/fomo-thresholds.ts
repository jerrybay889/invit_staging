/**
 * FOMO 경보 임계값 — LOCK v1.0 (2026-04-02)
 * 변경 금지. Jerry 단독 승인 필요.
 * Source: KCMI-1481 | KRX-2026 | SSRN-3631783
 */

export const FOMO_THRESHOLDS = {
  KOSPI_SURGE_THRESHOLD: 2.0,    // %
  KOSPI_PLUNGE_THRESHOLD: -2.0,  // %
  VOLUME_SURGE_PCT: 150,         // % (20일 이동평균 대비)
  VOLUME_LOOKBACK_DAYS: 20,
  COOLDOWN_HOURS: 24,
  LOCKED_VERSION: '1.0',
  LOCKED_DATE: '2026-04-02',
  SOURCE: 'KCMI-1481 | KRX-2026 | SSRN-3631783',
} as const;

/** MVP: standard 2종만. elevated는 Phase 2. */
export const FOMO_MESSAGES = {
  surge_standard:
    '오늘 시장이 크게 올랐습니다. 이런 날 충동 매수한 개인 투자자의 6개월 평균 수익률은 −8.3%입니다. 오늘의 원칙을 먼저 확인해 보세요.',
  plunge_standard:
    '오늘 시장이 크게 떨어졌습니다. \'지금이 기회\'라는 감정은 손실회피 편향 신호입니다. 충동 매수 전 원칙 일지를 먼저 기록하세요.',
} as const;
