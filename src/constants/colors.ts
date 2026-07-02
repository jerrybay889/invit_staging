/**
 * INVIT Color System — CLAUDE.md Color System 기준 (v2.1 정제 확장)
 * 변경 시 CLAUDE.md와 동기화 필수
 */

export const Colors = {
  // === Core Brand (CLAUDE.md Lock — 변경 금지) ===
  primary: '#01696F',       // Hydra Teal — 행동 완료, 규율 강화 CTA
  warning: '#DA7101',       // Costa Orange — FOMO 경보, 주의 신호
  error: '#A12C7B',         // Jenova Maroon — 편향 위험 강도 '높음'
  success: '#437A22',       // Gridania Green — 원칙 준수 확인
  surfaceBg: '#F7F6F2',     // Nexus Beige — 기본 배경
  textPrimary: '#28251D',   // Sylph Gray — 본문 텍스트

  // === Extended v2.1 Tokens ===
  // Surfaces
  surface: '#FFFFFF',
  surface2: '#F4F2EE',
  surfaceOff: '#EEEBE5',

  // Text hierarchy
  textSecondary: '#6B6560',
  textMuted: '#A09A93',
  textFaint: '#C5BFB8',

  // Borders
  border: '#E5E2DC',
  divider: '#E8E5DE',

  // Primary variants
  primaryLight: '#E8F3F3',
  primaryHighlight: '#007880', // v2.1 정제 틸 — supporting accent (primary 승격 보류, 호버·선택 상태 전용)

  // Warning surface text (경고 배경 위 텍스트 — warning 어두운 변형, 대비 확보)
  warningText: '#7A3400',

  // Korean market conventions (한국 증시 관습: 상승=빨강, 하락=파랑)
  redUp: '#C03030',
  blueDown: '#005A8A',

  // Highlight / Content
  gold: '#B87200',

  // Semantic aliases (backward compat)
  white: '#FFFFFF',
  inputBg: '#FFFFFF',

  // Discipline Score 색상 (CLAUDE.md UI 표시 기준 — 정량 점수 전용, error/warning과 의미 분리)
  //   error(#A12C7B)=편향 위험 신호 vs disciplineRed(#DC2626)=점수 위험 구간 (관습 빨강)
  //   warning(#DA7101)=FOMO 경보    vs disciplineGold(#D97706)=점수 보통 구간 (관습 주황)
  disciplineRed: '#DC2626',
  disciplineGold: '#D97706',
  disciplineGreen: '#437A22',
  disciplineTeal: '#01696F',
} as const;
