/**
 * AssessmentResultScreen — 편향 진단 결과 표시 (v2.1 업그레이드)
 * Lock 6: 면책 문구 필수 표시 (삭제·축약·위치 변경 금지)
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import ArchetypeResultCard from '../../components/ArchetypeResultCard';
import { LEGAL_DISCLAIMER } from '../../types/ai-feedback';
import { Colors } from '../../constants/colors';
import { Radius, Shadow, Spacing } from '../../constants/theme';
import { triggerAssessmentRefetch } from '../../lib/assessmentRefetch';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Analytics } from '../../lib/analytics';
import type { BiasFlags } from '../../types/database';

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

const BIAS_ITEMS: { key: keyof BiasFlags; label: string; color: string }[] = [
  { key: 'loss_aversion', label: '손실회피', color: Colors.warning },
  { key: 'fomo',          label: 'FOMO',    color: Colors.error },
  { key: 'overconfidence', label: '과잉확신', color: Colors.redUp },
  { key: 'disposition',   label: '처분효과', color: '#7B5EA7' },   // 편향 고유 시각 — 토큰 없음
  { key: 'herding',       label: '군집행동', color: Colors.gold },
  { key: 'present_bias',  label: '현재편향', color: '#2B7A78' },   // 편향 고유 시각 — 토큰 없음
  { key: 'confirmation',  label: '확증편향', color: '#5A7A22' },   // 편향 고유 시각 — 토큰 없음
];

function BiasFlagGrid({ biasFlags }: { biasFlags: Record<string, boolean> }) {
  return (
    <View style={gridStyles.container}>
      <Text style={gridStyles.title}>편향 지문</Text>
      <View style={gridStyles.grid}>
        {BIAS_ITEMS.map((item) => {
          const active = !!biasFlags[item.key];
          return (
            <View key={item.key} style={gridStyles.item}>
              <View style={[
                gridStyles.dot,
                active
                  ? { backgroundColor: item.color, borderColor: item.color }
                  : { backgroundColor: Colors.surface2, borderColor: Colors.border },
              ]}>
                {active && <Text style={gridStyles.dotCheck}>●</Text>}
              </View>
              <Text style={[
                gridStyles.label,
                { color: active ? item.color : Colors.textFaint },
              ]}>
                {item.label}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={gridStyles.legend}>
        <View style={gridStyles.legendItem}>
          <View style={[gridStyles.legendDot, { backgroundColor: Colors.primary }]} />
          <Text style={gridStyles.legendText}>감지된 편향</Text>
        </View>
        <View style={gridStyles.legendItem}>
          <View style={[gridStyles.legendDot, { backgroundColor: Colors.border }]} />
          <Text style={gridStyles.legendText}>해당 없음</Text>
        </View>
      </View>
    </View>
  );
}

const gridStyles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: Spacing.sm,
    ...Shadow.card,
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  item: {
    width: '30%',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotCheck: { fontSize: 16, color: Colors.white },
  label: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  legend: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: Radius.full },
  legendText: { fontSize: 11, color: Colors.textMuted },
});

export default function AssessmentResultScreen({ navigation, route }: Props) {
  const { archetype, biasFlags } = (route.params ?? {}) as {
    archetype: string;
    biasFlags: Record<string, boolean>;
  };
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const activeBiasCount = biasFlags
    ? Object.values(biasFlags).filter(Boolean).length
    : 0;

  const insight = ARCHETYPE_INSIGHTS[archetype] ?? ARCHETYPE_INSIGHTS.mixed;

  useEffect(() => {
    Analytics.track('onboarding_completed', { archetype, active_bias_count: activeBiasCount });
  }, []);

  const seedPrinciplesIfEmpty = async () => {
    if (!user) return;
    try {
      const { count } = await supabase
        .from('principles')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_active', true);
      if ((count ?? 0) > 0) return;

      const { data: masterPrinciples } = await supabase
        .rpc('get_principles_by_archetype', { p_archetype: archetype, p_limit: 5 });
      if (!masterPrinciples || masterPrinciples.length === 0) return;

      const seeds = (masterPrinciples as Array<{ body_text: string }>).map(
        (p, idx) => ({
          user_id: user.id,
          content: p.body_text,
          is_active: true,
          sort_order: idx,
        }),
      );
      await supabase.from('principles').insert(seeds);
    } catch (e) {
      console.warn('[G5] principle seed failed (non-fatal):', e);
    }
  };

  const handleContinue = async () => {
    setLoading(true);
    await seedPrinciplesIfEmpty();
    triggerAssessmentRefetch();
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
        {/* 완료 헤더 */}
        <View style={styles.header}>
          <View style={styles.completedBadge}>
            <Text style={styles.completedBadgeText}>✓ 편향 진단 완료</Text>
          </View>
          <Text style={styles.title}>나의 투자 편향 프로파일</Text>
          <Text style={styles.subtitle}>
            {activeBiasCount > 0
              ? `총 ${activeBiasCount}개의 편향 패턴이 감지되었습니다`
              : '투자 행동 패턴을 분석했습니다'}
          </Text>
        </View>

        {/* 편향 지문 시각화 */}
        {biasFlags && <BiasFlagGrid biasFlags={biasFlags} />}

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

        {/* INVIT 3단계 */}
        <View style={styles.nextStepBox}>
          <Text style={styles.nextStepTitle}>INVIT와 함께 시작하세요</Text>
          {[
            { num: '①', text: '매일 투자 일지 작성 — 행동과 감정을 기록합니다' },
            { num: '②', text: '규율 점수로 일지·원칙·감정 준수 수준을 측정합니다' },
            { num: '③', text: '아키타입 맞춤 코칭으로 편향을 단계적으로 개선합니다' },
          ].map(({ num, text }) => (
            <View key={num} style={styles.stepRow}>
              <View style={styles.stepNumBadge}>
                <Text style={styles.stepNum}>{num}</Text>
              </View>
              <Text style={styles.stepText}>{text}</Text>
            </View>
          ))}
        </View>

        {/* CTA */}
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
            <Text style={styles.primaryButtonText}>INVIT 시작하기 →</Text>
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
  scroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 48, gap: 12 },

  header: { gap: 6 },
  completedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary + '15',
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  completedBadgeText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  title: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary },
  subtitle: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },

  insightBox: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.card,
  },
  insightTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  insightText: { fontSize: 14, color: Colors.textPrimary, lineHeight: 22 },

  nextStepBox: {
    backgroundColor: Colors.primary + '08',
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary + '20',
  },
  nextStepTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 14,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 10,
  },
  stepNumBadge: {
    width: 26,
    height: 26,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNum: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  stepText: { flex: 1, fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },

  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    ...Shadow.elevated,
  },
  primaryButtonDisabled: { opacity: 0.65 },
  loadingContainer: { flexDirection: 'row', alignItems: 'center' },
  primaryButtonText: { color: Colors.white, fontSize: 16, fontWeight: '700' },

  disclaimerBox: {
    marginTop: 20,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  disclaimerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 6 },
  disclaimerIcon: { fontSize: 13, color: Colors.textSecondary },
  disclaimerTitle: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  disclaimerText: { fontSize: 11, lineHeight: 18, color: Colors.textMuted },
});
