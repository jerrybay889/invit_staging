/**
 * _shared/legalFilter.ts — Lock 6 투자자문 금지 필터 SSOT (LEGAL-001)
 *
 * 모든 콘텐츠 생성/입력 EF(generate-coaching, admin-briefing 등)는 이 모듈을 import 해
 * 동일한 금칙 패턴을 적용해야 한다. (현재 각 EF에 인라인 복제돼 있으며, CLI 배포 전환 시
 * `import { legalViolation } from '../_shared/legalFilter.ts'` 로 일원화한다.)
 *
 * 핵심: 단순 부분문자열(includes)이 아니라 공백/제로폭 정규화 후 정규식 매칭으로 우회를 차단.
 */

export const LEGAL_FORBIDDEN_PATTERNS: RegExp[] = [
  /매수\s*추천/, /매도\s*추천/, /매수\s*하세요/, /매도\s*하세요/,
  /목표가/, /적정가/, /수익\s*보장/, /원금\s*보장/,
  /할\s*것입니다/, /오를\s*것/, /떨어질\s*것/,
  /상승할\s*것/, /하락할\s*것/, /반등할\s*것/, /급등할\s*것/, /급락할\s*것/,
  /비중\s*확대/, /비중\s*축소/,
  /\d+\s*[%％]\s*(상승|하락|오를|떨어질|수익|손실)/,
];

/** 공백 변형(이중·전각공백)·제로폭 문자 삽입 우회 차단을 위한 정규화. */
export function normalizeForFilter(text: string): string {
  // 제로폭 문자(ZWSP/ZWNJ/ZWJ/BOM) 제거 + NBSP 포함 모든 공백 단일화(JS \s ⊇ U+00A0).
  return text.replace(/[​‌‍﻿]/g, '').replace(/\s+/g, ' ');
}

/** 위반 시 매칭된 패턴 문자열, 통과 시 null. */
export function legalViolation(text: string): string | null {
  const normalized = normalizeForFilter(text);
  for (const re of LEGAL_FORBIDDEN_PATTERNS) {
    if (re.test(normalized)) return re.toString();
  }
  return null;
}

/** 여러 필드 일괄 검사 (admin-briefing 패턴). */
export function legalViolationInFields(
  fields: Record<string, string | undefined | null>,
): { field: string; pattern: string } | null {
  for (const [field, value] of Object.entries(fields)) {
    if (!value) continue;
    const pattern = legalViolation(value);
    if (pattern) return { field, pattern };
  }
  return null;
}
