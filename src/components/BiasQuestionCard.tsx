/**
 * BiasQuestionCard — 편향 진단 개별 문항 카드
 * Schema LOCK v1.0: Q4는 3-point, 나머지는 5-point
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BiasQuestion } from '../constants/bias-questions';
import { Colors } from '../constants/colors';

interface Props {
  question: BiasQuestion;
  currentAnswer: number | null;
  onAnswer: (value: number) => void;
  questionIndex: number;
  totalQuestions: number;
}

export default function BiasQuestionCard({
  question, currentAnswer, onAnswer, questionIndex, totalQuestions,
}: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.progress}>
        <Text style={styles.progressText}>
          {questionIndex + 1} / {totalQuestions}
        </Text>
        <View style={styles.progressBar}>
          <View
            style={[styles.progressFill, { width: `${((questionIndex + 1) / totalQuestions) * 100}%` }]}
          />
        </View>
      </View>

      <View style={styles.badge}>
        <Text style={styles.badgeText}>{question.biasNameKo}</Text>
      </View>

      <Text style={styles.questionText}>{question.question}</Text>

      <View style={styles.options}>
        {question.options.map((option) => {
          const isSelected = currentAnswer === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.option, isSelected && styles.optionSelected]}
              onPress={() => onAnswer(option.value)}
            >
              <View style={[styles.radio, isSelected && styles.radioSelected]}>
                {isSelected && <View style={styles.radioInner} />}
              </View>
              <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {question.reversed && (
        <Text style={styles.reversedNote}>
          * 이 문항은 역방향 채점입니다
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 20 },
  progress: { marginBottom: 24 },
  progressText: { fontSize: 13, color: Colors.textMuted, marginBottom: 8, textAlign: 'right' },
  progressBar: {
    height: 4, backgroundColor: Colors.border, borderRadius: 2, overflow: 'hidden',
  },
  progressFill: { height: 4, backgroundColor: Colors.primary, borderRadius: 2 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary + '15',
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 16,
  },
  badgeText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  questionText: {
    fontSize: 18, fontWeight: '600', color: Colors.textPrimary,
    lineHeight: 28, marginBottom: 28,
  },
  options: { gap: 10 },
  option: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.white, borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.border,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  optionSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + '08' },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  radioSelected: { borderColor: Colors.primary },
  radioInner: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary,
  },
  optionText: { fontSize: 15, color: Colors.textPrimary, flex: 1 },
  optionTextSelected: { fontWeight: '500', color: Colors.primary },
  reversedNote: { fontSize: 12, color: Colors.textMuted, marginTop: 12, fontStyle: 'italic' },
});
