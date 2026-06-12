/**
 * AssessmentResultScreen — 편향 진단 결과 표시
 * Lock 6: 면책 문구 필수 표시 (삭제·축약·위치 변경 금지)
 */

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import ArchetypeResultCard from '../../components/ArchetypeResultCard';
import { LEGAL_DISCLAIMER } from '../../types/ai-feedback';
import { Colors } from '../../constants/colors';
import { triggerAssessmentRefetch } from '../../lib/assessmentRefetch';

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<any>;
};

const ARCHETYPE_INSIGHTS: Record<string, string> = {
  panic_reactor:
    '급락 시 공황 매도, 급등 시 충동 매수가 반복되는 패턴입니다. 감정이 투자 결정을 지배하고 있습니다. 원칙 일지가 가장 강력한 해결책입니다.',
  overconfident_holder:
    '수익 종목은 너무 빨리 팔고, 손실 종목은 너무 오래 보유하는 처분효과가 나타납니다. 매매 근거를 일지에 기록하면 패턴이 보입니다.',
  theme_chaser:
    '테마주·급등주를 군중과 함께 추격 매수하는 경향이 강합니다. FOMO 경보와 원칙 체크리스트로 충동을 걸러낼 수 있습니다.',
  rationalized_biased:
    '투자 근거를 논리적으로 포장하지만 확증편향이 작동하고 있습니다. 반대 의견을 일지에 기록하는 습관이 편향을 줄입니다.',
  shortterm_drifter:
    '단기 변동에 과민 반응하며 원칙을 자주 어기는 패턴이 나타납니다. 규율 점수 트래킹이 일관성 유지에 효과적입니다.',
  mixed:
    '여러 편향이 복합적으로 작용하고 있습니다. 매일 일지를 작성하면 어떤 패턴이 반복되는지 2~4주 안에 파악됩니다.',
};

export default function AssessmentResultScreen({ navigation, route }: Props) {
  const { archetype, biasFlags } = (route.params ?? {}) as {
    archetype: string;
    biasFlags: Record<string, boolean>;
  };
  const [loading, setLoading] = useState(false);

  const activeBiasCount = biasFlags
    ? Object.values(biasFlags).filter(Boolean).length
    : 0;

  const insight = ARCHETYPE_INSIGHTS[archetype] ?? ARCHETYPE_INSIGHTS.mixed;

  const handleContinue = () => {
    setLoading(true);
    // useBiasAssessment의 fetchAssessment를 재실행하여 hasAssessment=true → RootNavigator 자동 전환
    triggerAssessmentRefetch();
    // 5초 후에도 미전환 시 버튼 복원 (네트워크 장애 대비)
    const timer = setTimeout(() => setLoading(false), 5000);
    return () => clearTimeout(timer);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* 완료 배지 */}
        <View style={styles.completedBadge}>
          <Text style={styles.completedBadgeText}>✓ 1단계 편향 진단 완료</Text>
        </View>

        <Text style={styles.title}>진단 결과</Text>
        <Text style={styles.subtitle}>
          {activeBiasCount > 0
            ? `${activeBiasCount}개 편향 패턴이 감지되었습니다`
            : '투자 행동 패턴을 분석했습니다'}
        </Text>

        {/* 아키타입 카드 */}
        <ArchetypeResultCard
          archetype={archetype as any}
          biasFlags={(biasFlags ?? {}) as any}
        />

        {/* 아키타입 인사이트 */}
        <View style={styles.insightBox}>
          <Text style={styles.insightTitle}>이게 무슨 의미인가요?</Text>
          <Text style={styles.insightText}>{insight}</Text>
        </View>

        {/* 다음 단계 안내 */}
        <View style={styles.nextStepBox}>
          <Text style={styles.nextStepTitle}>INVIT와 함께 시작하세요</Text>
          {[
            { num: '①', text: '매일 투자 일지 작성 — 행동과 감정을 기록합니다' },
            { num: '②', text: '규율 점수로 일지·원칙·감정 준수 수준을 측정합니다' },
            { num: '③', text: '아키타입 맞춤 코칭으로 편향을 단계적으로 개선합니다' },
          ].map(({ num, text }) => (
            <View key={num} style={styles.stepRow}>
              <Text style={styles.stepNum}>{num}</Text>
              <Text style={styles.stepText}>{text}</Text>
            </View>
          ))}
        </View>

        {/* 시작하기 버튼 */}
        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
          onPress={handleContinue}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={Colors.white} size="small" />
              <Text style={[styles.primaryButtonText, { marginLeft: 8 }]}>준비 중...</Text>
            </View>
          ) : (
            <Text style={styles.primaryButtonText}>INVIT 시작하기</Text>
          )}
        </TouchableOpacity>

        {/* Lock 6 — 면책 문구 (삭제·축약·위치 변경 금지) */}
        <View style={styles.disclaimerBox}>
          <View style={styles.disclaimerHeader}>
            <Text style={styles.disclaimerIcon}>⚠</Text>
            <Text style={styles.disclaimerTitle}>이용 시 주의사항</Text>
          </View>
          <Text style={styles.disclaimerText}>{LEGAL_DISCLAIMER}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surfaceBg },
  scroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 48 },

  completedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary + '15',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  completedBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },

  title: { fontSize: 26, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 20 },

  insightBox: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  insightTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  insightText: { fontSize: 14, color: Colors.textPrimary, lineHeight: 22 },

  nextStepBox: {
    backgroundColor: Colors.primary + '08',
    borderRadius: 12,
    padding: 18,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.primary + '20',
  },
  nextStepTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 14,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  stepNum: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
    width: 24,
    marginTop: 1,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
  },

  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonDisabled: { opacity: 0.65 },
  loadingContainer: { flexDirection: 'row', alignItems: 'center' },
  primaryButtonText: { color: Colors.white, fontSize: 16, fontWeight: '700' },

  disclaimerBox: {
    marginTop: 32,
    padding: 16,
    backgroundColor: Colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E5DE',
  },
  disclaimerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  disclaimerIcon: { fontSize: 14, marginRight: 6 },
  disclaimerTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  disclaimerText: {
    fontSize: 11,
    lineHeight: 18,
    color: Colors.textMuted,
  },
});
