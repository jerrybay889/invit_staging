/**
 * 투자 일지 입력 옵션 상수 — 마스터플랜 0617 Pillar 1
 */

import type { TradeReasonTag, PrincipleCompliance } from '../types/database';

// 매매 이유 다중선택 태그 (매매일 일지)
export const TRADE_REASON_OPTIONS: { value: TradeReasonTag; label: string }[] = [
  { value: 'earnings', label: '실적 기대' },
  { value: 'technical', label: '기술적 매수' },
  { value: 'principle', label: '원칙에 따라' },
  { value: 'fomo', label: 'FOMO' },
  { value: 'youtube', label: '유튜브/뉴스 영향' },
  { value: 'split', label: '분할매수 계획' },
  { value: 'stoploss', label: '손절 원칙 준수' },
  { value: 'other', label: '기타' },
];

// 충동 신호로 분류되는 태그 (선택 시 원칙 카드 강조 트리거 — Phase 1+)
export const IMPULSE_REASON_TAGS: TradeReasonTag[] = ['fomo', 'youtube'];

// 원칙 준수 여부 (UI 기호 ↔ 저장값)
export const PRINCIPLE_COMPLIANCE_OPTIONS: {
  value: PrincipleCompliance;
  symbol: string;
  label: string;
}[] = [
  { value: 'kept', symbol: 'O', label: '지켰다' },
  { value: 'partial', symbol: '△', label: '일부' },
  { value: 'broken', symbol: 'X', label: '못 지켰다' },
];
