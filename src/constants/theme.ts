/**
 * INVIT Design Tokens — v2.1 기준
 * Radius, Spacing, Shadow, Typography
 */

// Radius 스냅맵: 하드코딩 → 토큰 치환 기준
//   3·4·5·6   → xs (6)   칩·뱃지·입력 모서리
//   8·10·11   → sm (8)   소형 카드 내부
//   12·13·14  → md (14)  버튼·표준 카드
//   16·18     → lg (18)  대형 카드·모달 섹션
//   20·22·24  → xl (22)  바텀시트·히어로
//   50·9999   → full     원형
export const Radius = {
  xs: 6,
  sm: 8,
  md: 14,
  lg: 18,
  xl: 22,
  full: 9999,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  smd: 12,   // 카드 내부 표준 간격 (최다 사용값 ×34)
  md: 16,
  mlg: 20,   // 카드 패딩 다빈도 (사용 ×15)
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const Shadow = {
  card: {
    shadowColor: '#1a1710',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  elevated: {
    shadowColor: '#1a1710',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 4,
  },
  modal: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
} as const;

export const Typography = {
  heading1: { fontSize: 28, fontWeight: '700' as const, lineHeight: 36 },
  heading2: { fontSize: 22, fontWeight: '700' as const, lineHeight: 30 },
  heading3: { fontSize: 18, fontWeight: '600' as const, lineHeight: 26 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodySmall: { fontSize: 13, fontWeight: '400' as const, lineHeight: 19 },
  caption: { fontSize: 11, fontWeight: '400' as const, lineHeight: 16 },
  label: { fontSize: 11, fontWeight: '700' as const, lineHeight: 16, letterSpacing: 0.8 },
} as const;
