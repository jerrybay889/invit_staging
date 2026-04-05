/**
 * 규율 점수 상수 — LOCK v1.0
 * 변경 금지. Jerry 단독 승인 필요.
 */

export const DISCIPLINE_WEIGHTS = {
  JOURNAL: 0.40,
  PRINCIPLE: 0.40,
  EMOTION: 0.20,
} as const;

export const DISCIPLINE_THRESHOLDS = {
  /** 일지 미작성 시 최대 점수 상한 */
  MAX_WITHOUT_JOURNAL: 60,
} as const;

export const DISCIPLINE_LABELS = {
  LOW:    { min: 0,  max: 39,  color: '#E53935', message: '오늘 원칙 점검이 필요합니다' },
  MEDIUM: { min: 40, max: 69,  color: '#F9A825', message: '꾸준히 하고 있습니다' },
  HIGH:   { min: 70, max: 89,  color: '#437A22', message: '훌륭합니다!' },
  MASTER: { min: 90, max: 100, color: '#01696F', message: '오늘의 원칙 마스터' },
} as const;

/**
 * Emotion Score — Inverted-V 정규화
 * emotion_checkin 3(평온)에서 100점, 1/5(극단)에서 0점
 */
export function calculateEmotionScore(emotionCheckin: number): number {
  return (1 - Math.abs(emotionCheckin - 3) / 2) * 100;
}

/** 점수 범위에 따른 색상 반환 */
export function getDisciplineColor(score: number): string {
  if (score >= 90) return DISCIPLINE_LABELS.MASTER.color;
  if (score >= 70) return DISCIPLINE_LABELS.HIGH.color;
  if (score >= 40) return DISCIPLINE_LABELS.MEDIUM.color;
  return DISCIPLINE_LABELS.LOW.color;
}

/** 점수 범위에 따른 메시지 반환 */
export function getDisciplineMessage(score: number): string {
  if (score >= 90) return DISCIPLINE_LABELS.MASTER.message;
  if (score >= 70) return DISCIPLINE_LABELS.HIGH.message;
  if (score >= 40) return DISCIPLINE_LABELS.MEDIUM.message;
  return DISCIPLINE_LABELS.LOW.message;
}
