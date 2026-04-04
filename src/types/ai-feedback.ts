// CLAUDE.md Lock 6 준거 — disclaimer 필드는 고정 문자열만 허용. 동적 생성 금지.
// coaching_cards 테이블 content JSONB 스키마 v1.0

import type { Archetype } from './database';

/**
 * Lock 6 면책 고지문 — 삭제·축약·위치 변경 금지.
 * 이 문자열은 모든 코칭 카드 응답에 고정 포함된다.
 */
export const LEGAL_DISCLAIMER =
  '[중요 고지사항] 본 진단 결과는 귀하의 투자 행동 패턴에 대한 자기 인식을 돕기 위한 교육적 도구로서, 특정 금융투자상품에 대한 투자 권유, 매수·매도 추천, 또는 투자 적합성 판단을 목적으로 하지 않습니다. 본 서비스는 「자본시장과 금융투자업에 관한 법률」에 따른 투자자문업에 해당하지 않으며, 해당 법률에 따른 등록 투자자문업자의 서비스를 대체하지 않습니다. 진단 결과는 귀하의 행동 경향성을 참고하는 용도로만 사용하시기 바라며, 실제 투자 결정은 귀하 본인의 판단과 책임 하에 이루어져야 합니다. 투자에는 원금 손실의 위험이 있습니다. 본 진단 결과에 기반한 투자 손실에 대하여 (주)글로보더는 법적 책임을 부담하지 않습니다.' as const;

/**
 * generate-coaching EF가 반환하는 AI 코칭 카드 응답 스키마.
 * coaching_cards 테이블의 content JSONB 구조와 1:1 매핑.
 */
export interface CoachingFeedback {
  coaching_id: string;          // UUID
  user_id: string;
  date: string;                 // YYYY-MM-DD
  archetype: Archetype;         // 5종 + mixed
  message: string;              // AI 생성 코칭 본문
  disclaimer: typeof LEGAL_DISCLAIMER; // Lock 6 면책 고지문 고정값
  bias_focus: string[];         // 해당 회차 집중 편향 목록
  created_at: string;           // ISO 8601
}

/**
 * Lock 5 fallback 고정 메시지 — AI 비용 초과 시 반환.
 */
export const COACHING_FALLBACK_MESSAGE =
  '오늘의 원칙을 다시 확인해보세요. 일지를 작성하면 내일 새로운 코칭이 준비됩니다.' as const;

/**
 * Lock 6 투자자문 금지 필터 — 금지 키워드 목록.
 * Edge Function generate-coaching 후처리 단계에서만 사용.
 */
export const LEGAL_FILTER_KEYWORDS = [
  '매수 추천',
  '매도 추천',
  '목표가',
  '수익 보장',
  '할 것입니다',
  '오를 것',
  '떨어질 것',
] as const;
