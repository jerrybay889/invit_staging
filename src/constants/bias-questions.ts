/**
 * 편향 진단 7문항 정의 — Schema LOCK v1.0
 *
 * Q1~Q3, Q5, Q7: 5-point Likert (높을수록 편향↑)
 * Q4: 3-point forced choice (1=편향 최강, 3=없음)
 * Q6: 5-point intertemporal (낮을수록 편향↑ — 역방향)
 *
 * v2.1 업그레이드: 시나리오형 행동 프레이밍 + anchors + infoNote
 * (key, biasName, scale, reversed, 임계값 — 변경 금지)
 */

export interface BiasQuestion {
  key: 'q1' | 'q2' | 'q3' | 'q4' | 'q5' | 'q6' | 'q7';
  biasName: string;
  biasNameKo: string;
  question: string;
  scale: 3 | 5;
  reversed: boolean;
  options: { value: number; label: string }[];
  anchors?: { low: string; high: string };
  infoNote?: string;
}

export const BIAS_QUESTIONS: BiasQuestion[] = [
  {
    key: 'q1',
    biasName: 'loss_aversion',
    biasNameKo: '손실회피',
    question: '보유 종목이 -10% 이상 하락했을 때, "지금 팔아야 하나"라는 충동이 드는 정도는?',
    scale: 5,
    reversed: false,
    anchors: { low: '전혀 안 든다', high: '항상 강하게 든다' },
    infoNote: '손실 상황에서의 감정적 반응을 측정합니다',
    options: [
      { value: 1, label: '전혀 안 든다' },
      { value: 2, label: '거의 안 든다' },
      { value: 3, label: '가끔 든다' },
      { value: 4, label: '자주 든다' },
      { value: 5, label: '항상 강하게 든다' },
    ],
  },
  {
    key: 'q2',
    biasName: 'fomo',
    biasNameKo: 'FOMO',
    question: '커뮤니티나 지인으로부터 특정 종목 급등 소식을 들으면, 나도 매수해야 할 것 같은 불안감이 드는 정도는?',
    scale: 5,
    reversed: false,
    anchors: { low: '전혀 안 든다', high: '매우 강하게 든다' },
    infoNote: '타인의 수익 소식에 대한 충동 반응을 측정합니다',
    options: [
      { value: 1, label: '전혀 안 든다' },
      { value: 2, label: '거의 안 든다' },
      { value: 3, label: '가끔 든다' },
      { value: 4, label: '자주 든다' },
      { value: 5, label: '매우 강하게 든다' },
    ],
  },
  {
    key: 'q3',
    biasName: 'overconfidence',
    biasNameKo: '과잉확신',
    question: '내 투자 판단이 시장 평균이나 전문가보다 나을 것이라는 자신감은?',
    scale: 5,
    reversed: false,
    anchors: { low: '전혀 없다', high: '매우 강하다' },
    infoNote: '자신의 투자 능력에 대한 주관적 확신 수준을 측정합니다',
    options: [
      { value: 1, label: '전혀 없다' },
      { value: 2, label: '별로 없다' },
      { value: 3, label: '보통이다' },
      { value: 4, label: '있다' },
      { value: 5, label: '매우 강하다' },
    ],
  },
  {
    key: 'q4',
    biasName: 'disposition',
    biasNameKo: '처분효과',
    question: '수익 중인 A 종목과 손실 중인 B 종목 — 자금이 필요할 때 어떻게 하시겠습니까?',
    scale: 3,
    reversed: false,
    infoNote: '1번이 처분효과 편향이 가장 강한 선택입니다',
    options: [
      { value: 1, label: 'A(수익) 종목을 먼저 매도한다' },
      { value: 2, label: '상황에 따라 다르다' },
      { value: 3, label: 'B(손실) 종목을 먼저 정리한다' },
    ],
  },
  {
    key: 'q5',
    biasName: 'herding',
    biasNameKo: '군집행동',
    question: '유명 인플루언서·커뮤니티에서 강하게 추천하는 종목을 실제로 매수한 빈도는?',
    scale: 5,
    reversed: false,
    anchors: { low: '전혀 없다', high: '자주 그렇다' },
    infoNote: '군중을 따라 실제 행동한 빈도를 측정합니다',
    options: [
      { value: 1, label: '전혀 없다' },
      { value: 2, label: '거의 없다' },
      { value: 3, label: '가끔 있다' },
      { value: 4, label: '자주 있다' },
      { value: 5, label: '항상 그렇다' },
    ],
  },
  {
    key: 'q6',
    biasName: 'present_bias',
    biasNameKo: '현재편향',
    question: '단기 변동보다 장기 투자 계획을 우선시하며 실천하는 정도는?',
    scale: 5,
    reversed: true,
    anchors: { low: '단기에 집중', high: '장기를 실천' },
    infoNote: '높을수록 편향이 낮습니다 (장기 관점 유지)',
    options: [
      { value: 1, label: '단기에 집중' },
      { value: 2, label: '단기가 우선' },
      { value: 3, label: '보통이다' },
      { value: 4, label: '장기가 우선' },
      { value: 5, label: '장기를 실천' },
    ],
  },
  {
    key: 'q7',
    biasName: 'confirmation',
    biasNameKo: '확증편향',
    question: '이미 매수한 종목의 부정적 뉴스를 들었을 때, 무시하거나 반박 근거를 찾게 되는 정도는?',
    scale: 5,
    reversed: false,
    anchors: { low: '객관적으로 받아들인다', high: '항상 무시한다' },
    infoNote: '반대 정보를 처리하는 방식을 측정합니다',
    options: [
      { value: 1, label: '객관적으로 받아들인다' },
      { value: 2, label: '대체로 수용한다' },
      { value: 3, label: '가끔 무시한다' },
      { value: 4, label: '자주 무시한다' },
      { value: 5, label: '항상 무시한다' },
    ],
  },
];
