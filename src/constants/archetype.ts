/**
 * 코칭 아키타입 정의 — Schema LOCK v1.0
 * 판정 우선순위 순서가 중요. 변경 금지.
 */

import type { Archetype, BiasFlags } from '../types/database';

export interface ArchetypeDefinition {
  key: Archetype;
  nameKo: string;
  description: string;
  color: string;
  iconConcept: string;
}

export const ARCHETYPE_DEFINITIONS: ArchetypeDefinition[] = [
  {
    key: 'panic_reactor',
    nameKo: '패닉 리액터',
    description: '급등락에 가장 취약한 유형',
    color: '#DA7101',
    iconConcept: '불꽃/파도',
  },
  {
    key: 'overconfident_holder',
    nameKo: '확신 홀더',
    description: '손실 종목 보유, 근거 왜곡',
    color: '#01696F',
    iconConcept: '방패/잠금',
  },
  {
    key: 'theme_chaser',
    nameKo: '테마 체이서',
    description: '테마주·급등주 추격 매수',
    color: '#A12C7B',
    iconConcept: '화살/군중',
  },
  {
    key: 'rationalized_biased',
    nameKo: '합리화 편향자',
    description: '논리적 포장의 감정 투자',
    color: '#1565C0',
    iconConcept: '거울/안경',
  },
  {
    key: 'shortterm_drifter',
    nameKo: '단기 표류자',
    description: '단기 변동 과민, 원칙 불이행',
    color: '#F9A825',
    iconConcept: '나침반/안개',
  },
  {
    key: 'mixed',
    nameKo: '복합형',
    description: '복합 편향 — 추가 분석 필요',
    color: '#757575',
    iconConcept: '퍼즐 조각',
  },
];

/**
 * 아키타입 판정 로직 (우선순위 순)
 * Schema LOCK v1.0 기준. 변경 금지.
 */
export function determineArchetype(flags: BiasFlags): Archetype {
  if (flags.loss_aversion && flags.fomo && flags.herding) {
    return 'panic_reactor';
  }
  if (flags.overconfidence && flags.confirmation && flags.disposition) {
    return 'overconfident_holder';
  }
  if (flags.fomo && flags.herding && flags.present_bias) {
    return 'theme_chaser';
  }
  if (flags.overconfidence && flags.confirmation) {
    return 'rationalized_biased';
  }
  if (flags.present_bias && flags.loss_aversion) {
    return 'shortterm_drifter';
  }
  return 'mixed';
}
