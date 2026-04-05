/**
 * INVIT Color System — CLAUDE.md Color System 기준
 * 변경 시 CLAUDE.md와 동기화 필수
 */

export const Colors = {
  primary: '#01696F',       // Hydra Teal — 행동 완료, 규율 강화 CTA
  warning: '#DA7101',       // Costa Orange — FOMO 경보, 주의 신호
  error: '#A12C7B',         // Jenova Maroon — 편향 위험 강도 '높음'
  success: '#437A22',       // Gridania Green — 원칙 준수 확인
  surfaceBg: '#F7F6F2',     // Nexus Beige — 기본 배경
  textPrimary: '#28251D',   // Sylph Gray — 본문 텍스트
  textSecondary: '#6B6560', // 보조 텍스트
  textMuted: '#A09A93',     // 비활성 텍스트
  white: '#FFFFFF',
  border: '#E5E2DC',
  inputBg: '#FFFFFF',

  // Discipline Score 색상 (CLAUDE.md UI 표시 기준)
  disciplineRed: '#DC2626',
  disciplineGold: '#D97706',
  disciplineGreen: '#437A22',
  disciplineTeal: '#01696F',
} as const;
