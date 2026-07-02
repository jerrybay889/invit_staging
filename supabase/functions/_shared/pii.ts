/**
 * _shared/pii.ts — Lock 7 PII 마스킹 SSOT (PII-001)
 *
 * 외부 모델(Claude/OpenAI)로 나가는 모든 사용자유래 텍스트는 maskPII로 전처리한다.
 * 분석 이벤트(log-events)는 scrubProps로 키 블랙리스트 + 값 스크럽 + 크기 상한을 적용한다.
 */

/** 자유텍스트에서 PII 패턴 마스킹(주민번호·카드·전화·이메일·계좌). */
export function maskPII(text: string): string {
  return text
    .replace(/\d{6}\s*-\s*\d{7}/g, '[RRN]')                       // 주민등록번호
    .replace(/\d{4}[- ]\d{4}[- ]\d{4}[- ]\d{4}/g, '[CARD]')       // 카드번호
    .replace(/\d{2,3}-\d{3,4}-\d{4}/g, '[PHONE]')                 // 전화
    .replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL]')                  // 이메일
    .replace(/\d{10,}/g, '[ACCOUNT]');                            // 계좌/장수 숫자
}

const PII_PROP_KEYS = new Set(['email', 'phone', 'name', 'display_name', 'account', 'ticker_with_pnl']);
const MAX_PROPS_BYTES = 4000;

function scrubValue(v: unknown): unknown {
  if (typeof v === 'string') return maskPII(v).slice(0, 500);
  if (Array.isArray(v)) return v.slice(0, 50).map(scrubValue);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (PII_PROP_KEYS.has(k.toLowerCase())) continue; // PII 키 제거(중첩 포함)
      out[k] = scrubValue(val);
    }
    return out;
  }
  return v;
}

/** 분석 props: 키 블랙리스트 + 값 스크럽 + 크기 상한. */
export function scrubProps(props: Record<string, unknown>): Record<string, unknown> {
  const safe = scrubValue(props) as Record<string, unknown>;
  if (JSON.stringify(safe).length > MAX_PROPS_BYTES) return { _truncated: true };
  return safe;
}
