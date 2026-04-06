/**
 * BiasAssessmentScreen — 편향 진단 7문항
 * Schema LOCK v1.0: Q4는 1~3, 나머지 1~5
 * Lock 3: 클라이언트에서 bias_flags 직접 계산 금지 → submit-bias-assessment EF 호출만
 */

import React, { useState } from 'react';
import {
  View, TouchableOpacity, Text, StyleSheet, SafeAreaView, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BIAS_QUESTIONS } from '../../constants/bias-questions';
import BiasQuestionCard from '../../components/BiasQuestionCard';
import { supabase } from '../../lib/supabase';
import { BiasAnswers } from '../../types/database';
import { Colors } from '../../constants/colors';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function BiasAssessmentScreen({ navigation }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const currentQuestion = BIAS_QUESTIONS[currentIndex];
  const currentAnswer = answers[currentQuestion.key] ?? null;
  const isLastQuestion = currentIndex === BIAS_QUESTIONS.length - 1;
  const canProceed = currentAnswer !== null;

  const handleAnswer = (value: number) => {
    setAnswers((prev) => ({ ...prev, [currentQuestion.key]: value }));
  };

  const handleNext = async () => {
    if (!canProceed) return;

    if (!isLastQuestion) {
      setCurrentIndex((prev) => prev + 1);
      return;
    }

    // 마지막 문항 → submit-bias-assessment Edge Function 호출
    // Lock 3: 클라이언트에서 직접 DB 쓰기 금지. EF만 호출.
    setSubmitting(true);

    const biasAnswers: BiasAnswers = {
      q1: answers.q1,
      q2: answers.q2,
      q3: answers.q3,
      q4: answers.q4,
      q5: answers.q5,
      q6: answers.q6,
      q7: answers.q7,
    };

    const { data, error } = await supabase.functions.invoke('submit-bias-assessment', {
      body: { answers: biasAnswers },
    });

    setSubmitting(false);

    if (error) {
      Alert.alert('진단 오류', '진단 결과 저장에 실패했습니다. 다시 시도해주세요.');
      return;
    }

    navigation.replace('AssessmentResult', {
      archetype: data.archetype,
      biasFlags: data.bias_flags,
    });
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
      >
        <BiasQuestionCard
          question={currentQuestion}
          currentAnswer={currentAnswer}
          onAnswer={handleAnswer}
          questionIndex={currentIndex}
          totalQuestions={BIAS_QUESTIONS.length}
        />
      </ScrollView>

      <View style={styles.nav}>
        {currentIndex > 0 && (
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>이전</Text>
          </TouchableOpacity>
        )}
        <View style={styles.spacer} />
        <TouchableOpacity
          style={[styles.nextButton, !canProceed && styles.disabledButton]}
          onPress={handleNext}
          disabled={!canProceed || submitting}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.nextButtonText}>
              {isLastQuestion ? '진단 완료' : '다음'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surfaceBg },
  scroll: { flexGrow: 1, paddingBottom: 16 },
  nav: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 20, paddingBottom: 28,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  spacer: { flex: 1 },
  backButton: {
    paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
  },
  backButtonText: { fontSize: 15, color: Colors.textSecondary },
  nextButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 28, paddingVertical: 12,
    borderRadius: 10, minWidth: 100, alignItems: 'center',
  },
  disabledButton: { opacity: 0.4 },
  nextButtonText: { fontSize: 15, fontWeight: '600', color: Colors.white },
});
