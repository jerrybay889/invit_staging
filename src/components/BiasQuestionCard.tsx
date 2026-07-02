/**
 * BiasQuestionCard — 편향 진단 개별 문항 카드 (v2.1 시나리오형)
 * Schema LOCK v1.0: Q4는 3-point, 나머지는 5-point
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BiasQuestion } from '../constants/bias-questions';
import { Colors } from '../constants/colors';
import { Radius } from '../constants/theme';

interface Props {
  question: BiasQuestion;
  currentAnswer: number | null;
  onAnswer: (value: number) => void;
  questionIndex: number;
  totalQuestions: number;
}

// 5-point 스케일 색상 (1=low bias=green → 5=high bias=maroon)
const SCALE_COLORS = [
  Colors.success,  // 1 — Gridania Green
  '#7BAF4A',       // 2 — 연한 초록 (중간 토큰 없음)
  '#C9A030',       // 3 — 중립 골드 (중간 토큰 없음)
  Colors.warning,  // 4 — Costa Orange
  Colors.error,    // 5 — Jenova Maroon
];

// 역방향(q6): 1=high bias=maroon → 5=low bias=green
const SCALE_COLORS_REV = [...SCALE_COLORS].reverse();

// Q4 3-point: 1=red(최강편향), 2=gold(중립), 3=green(없음)
const Q4_COLORS = [Colors.error, '#C9A030', Colors.success];

function getOptionColor(value: number, scale: 3 | 5, reversed: boolean): string {
  if (scale === 5) {
    return (reversed ? SCALE_COLORS_REV : SCALE_COLORS)[value - 1];
  }
  return Q4_COLORS[value - 1];
}

export default function BiasQuestionCard({
  question, currentAnswer, onAnswer, questionIndex, totalQuestions,
}: Props) {
  const progress = (questionIndex + 1) / totalQuestions;
  const is5Point = question.scale === 5;

  return (
    <View style={styles.container}>
      {/* 진행 표시 */}
      <View style={styles.progressHeader}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
        </View>
        <Text style={styles.progressText}>{questionIndex + 1} / {totalQuestions}</Text>
      </View>

      {/* 편향 배지 */}
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{question.biasNameKo}</Text>
      </View>

      {/* 문항 (시나리오형) */}
      <Text style={styles.questionText}>{question.question}</Text>

      {/* 측정 안내 */}
      {question.infoNote && (
        <View style={styles.infoNote}>
          <Text style={styles.infoNoteText}>ℹ {question.infoNote}</Text>
        </View>
      )}

      {/* 선택지 */}
      {is5Point ? (
        /* 5-point 수평 컬러 스케일 */
        <View style={styles.scaleWrapper}>
          <View style={styles.scaleRow}>
            {question.options.map((opt) => {
              const color = getOptionColor(opt.value, question.scale, question.reversed);
              const isSelected = currentAnswer === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => onAnswer(opt.value)}
                  style={styles.scaleBtnWrapper}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.scaleCircle,
                    { borderColor: color + '80' },
                    isSelected && { backgroundColor: color, borderColor: color },
                  ]}>
                    <Text style={[
                      styles.scaleNumber,
                      { color: isSelected ? Colors.white : color },
                    ]}>
                      {opt.value}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          {question.anchors && (
            <View style={styles.anchors}>
              <Text style={styles.anchorText}>{question.anchors.low}</Text>
              <Text style={styles.anchorText}>{question.anchors.high}</Text>
            </View>
          )}
        </View>
      ) : (
        /* 3-point 카드형 (Q4 처분효과) */
        <View style={styles.options}>
          {question.options.map((opt) => {
            const color = getOptionColor(opt.value, question.scale, question.reversed);
            const isSelected = currentAnswer === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.option,
                  { borderColor: isSelected ? color : Colors.border },
                  isSelected && { backgroundColor: color + '0E' },
                ]}
                onPress={() => onAnswer(opt.value)}
                activeOpacity={0.7}
              >
                <View style={[styles.optionIndicator, { backgroundColor: color + '22', borderColor: color + '50' }]}>
                  <Text style={[styles.optionIndicatorText, { color }]}>{opt.value}</Text>
                </View>
                <Text style={[
                  styles.optionText,
                  isSelected && { color, fontWeight: '600' },
                ]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* 선택된 답변 표시 (5-point) */}
      {is5Point && currentAnswer !== null && (
        <Text style={styles.selectedLabel}>
          {question.options.find((o) => o.value === currentAnswer)?.label}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },

  progressHeader: { marginBottom: 20 },
  progressBar: {
    height: 3,
    backgroundColor: Colors.border,
    borderRadius: Radius.full,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: 3,
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
  },
  progressText: { fontSize: 12, color: Colors.textFaint, textAlign: 'right' },

  badge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary + '14',
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 14,
  },
  badgeText: { fontSize: 12, fontWeight: '700', color: Colors.primary, letterSpacing: 0.3 },

  questionText: {
    fontSize: 19,
    fontWeight: '600',
    color: Colors.textPrimary,
    lineHeight: 28,
    marginBottom: 14,
  },

  infoNote: {
    backgroundColor: Colors.surface2,
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 24,
  },
  infoNoteText: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },

  // 5-point 수평 스케일
  scaleWrapper: { marginTop: 4 },
  scaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 10,
  },
  scaleBtnWrapper: { alignItems: 'center', flex: 1 },
  scaleCircle: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  scaleNumber: { fontSize: 16, fontWeight: '700' },

  anchors: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  anchorText: { fontSize: 11, color: Colors.textMuted, maxWidth: 90 },

  selectedLabel: {
    marginTop: 12,
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '500',
    textAlign: 'center',
  },

  // 3-point 카드형 (Q4)
  options: { gap: 10, marginTop: 4 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  optionIndicator: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIndicatorText: { fontSize: 13, fontWeight: '700' },
  optionText: { fontSize: 15, color: Colors.textPrimary, flex: 1, lineHeight: 20 },
});
