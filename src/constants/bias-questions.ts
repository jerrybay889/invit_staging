/**
 * 편향 진단 7문항 정의 — Schema LOCK v1.0
 *
 * Q1~Q3, Q5, Q7: 5-point Likert (높을수록 편향↑)
 * Q4: 3-point forced choice (1=편향 최강, 3=없음)
 * Q6: 5-point intertemporal (낮을수록 편향↑ — 역방향)
 */

export interface BiasQuestion {
  key: 'q1' | 'q2' | 'q3' | 'q4' | 'q5' | 'q6' | 'q7';
  biasName: string;
  biasNameKo: string;
  question: string;
  scale: 3 | 5;
  reversed: boolean;
  options: { value: number; label: string }[];
}

export const BIAS_QUESTIONS: BiasQuestion[] = [
  {
    key: 'q1',
    biasName: 'loss_aversion',
    biasNameKo: '손실회피',
    question: '주가가 떨어지기 시작하면 즉시 매도하고 싶은 충동을 느낀다.',
    scale: 5,
    reversed: false,
    options: [
      { value: 1, label: '전혀 아니다' },
      { value: 2, label: '그렇지 않다' },
      { value: 3, label: '보통이다' },
      { value: 4, label: '그렇다' },
      { value: 5, label: '매우 그렇다' },
    ],
  },
  {
    key: 'q2',
    biasName: 'fomo',
    biasNameKo: 'FOMO',
    question: '주변 사람이 특정 종목으로 수익을 냈다는 이야기를 들으면 나도 매수해야 할 것 같은 불안감을 느낀다.',
    scale: 5,
    reversed: false,
    options: [
      { value: 1, label: '전혀 아니다' },
      { value: 2, label: '그렇지 않다' },
      { value: 3, label: '보통이다' },
      { value: 4, label: '그렇다' },
      { value: 5, label: '매우 그렇다' },
    ],
  },
  {
    key: 'q3',
    biasName: 'overconfidence',
    biasNameKo: '과잉확신',
    question: '나의 투자 판단이 전문가보다 나을 때가 많다고 느낀다.',
    scale: 5,
    reversed: false,
    options: [
      { value: 1, label: '전혀 아니다' },
      { value: 2, label: '그렇지 않다' },
      { value: 3, label: '보통이다' },
      { value: 4, label: '그렇다' },
      { value: 5, label: '매우 그렇다' },
    ],
  },
  {
    key: 'q4',
    biasName: 'disposition',
    biasNameKo: '처분효과',
    question: '수익이 나고 있는 종목과 손실이 나고 있는 종목이 있을 때 어떻게 하시겠습니까?',
    scale: 3,
    reversed: false, // 1=편향 최강, 3=없음
    options: [
      { value: 1, label: '수익 종목을 먼저 매도한다' },
      { value: 2, label: '상황에 따라 다르다' },
      { value: 3, label: '손실 종목을 먼저 정리한다' },
    ],
  },
  {
    key: 'q5',
    biasName: 'herding',
    biasNameKo: '군집행동',
    question: '커뮤니티나 뉴스에서 특정 종목이 화제가 되면 매수를 고려한다.',
    scale: 5,
    reversed: false,
    options: [
      { value: 1, label: '전혀 아니다' },
      { value: 2, label: '거의 안 그렇다' },
      { value: 3, label: '가끔 그렇다' },
      { value: 4, label: '자주 그렇다' },
      { value: 5, label: '항상 그렇다' },
    ],
  },
  {
    key: 'q6',
    biasName: 'present_bias',
    biasNameKo: '현재편향',
    question: '단기 수익보다 장기 투자 계획을 더 중요하게 여긴다.',
    scale: 5,
    reversed: true, // 낮을수록 편향↑
    options: [
      { value: 1, label: '전혀 아니다' },
      { value: 2, label: '그렇지 않다' },
      { value: 3, label: '보통이다' },
      { value: 4, label: '그렇다' },
      { value: 5, label: '매우 그렇다' },
    ],
  },
  {
    key: 'q7',
    biasName: 'confirmation',
    biasNameKo: '확증편향',
    question: '이미 매수한 종목에 대해 긍정적인 정보만 찾게 된다.',
    scale: 5,
    reversed: false,
    options: [
      { value: 1, label: '전혀 아니다' },
      { value: 2, label: '그렇지 않다' },
      { value: 3, label: '보통이다' },
      { value: 4, label: '그렇다' },
      { value: 5, label: '매우 그렇다' },
    ],
  },
];
