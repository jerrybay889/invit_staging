/**
 * AssessmentResultScreen — 편향 진단 결과 표시
 * Lock 6: 면책 문구 필수 표시 (삭제·축약·위치 변경 금지)
 */

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import ArchetypeResultCard from '../../components/ArchetypeResultCard';
import { LEGAL_DISCLAIMER } from '../../types/ai-feedback';
import { Colors } from '../../constants/colors';

type Props = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<any>;
};

export default function AssessmentResultScreen({ navigation, route }: Props) {
  const { archetype, biasFlags } = route.params as {
    archetype: string;
    biasFlags: Record<string, boolean>;
  };
  const [loading, setLoading] = useState(false);

  const handleContinue = () => {
    // 결과 확인 후 메인 앱으로 이동
    // useBiasAssessment hook이 DB 변경을 감지하여 자동으로 MainNavigator로 전환
    // (RootNavigator의 조건부 렌더링이 작동)
    // 안전을 위해 1초 대기
    setLoading(true);
    setTimeout(() => {
      // 이 시점에서 RootNavigator가 hasAssessment = true를 감지하고
      // 자동으로 OnboardingStack에서 MainStack으로 전환됨
    }, 1000);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
      >
        <Text style={styles.title}>진단 결과</Text>
        <Text style={styles.subtitle}>
          당신의 투자 행동 패턴을 분석했습니다
        </Text>

        <ArchetypeResultCard
          archetype={archetype as any}
          biasFlags={biasFlags as any}
        />

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>다음 단계</Text>
          <Text style={styles.infoText}>
            매일 투자 일지를 작성하고 원칙을 점검하세요.{'\n'}
            규율 점수와 맞춤 코칭으로 투자 습관을 개선할 수 있습니다.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
          onPress={handleContinue}
          disabled={loading}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={Colors.white} size="small" />
              <Text style={[styles.primaryButtonText, { marginLeft: 8 }]}>준비 중...</Text>
            </View>
          ) : (
            <Text style={styles.primaryButtonText}>시작하기</Text>
          )}
        </TouchableOpacity>

        {/* Lock 6 — 면책 문구 (삭제·축약·위치 변경 금지) */}
        <View style={styles.disclaimerBox}>
          <Text style={styles.disclaimerText}>{LEGAL_DISCLAIMER}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surfaceBg },
  scroll: { paddingHorizontal: 24, paddingTop: 40, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '700', color: Colors.textPrimary },
  subtitle: {
    fontSize: 15, color: Colors.textSecondary, marginTop: 8, marginBottom: 24,
  },
  infoBox: {
    backgroundColor: Colors.primary + '08',
    borderRadius: 12, padding: 16, marginTop: 16,
    borderWidth: 1, borderColor: Colors.primary + '20',
  },
  infoTitle: { fontSize: 15, fontWeight: '600', color: Colors.primary, marginBottom: 6 },
  infoText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  primaryButton: {
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginTop: 24,
  },
  primaryButtonDisabled: { opacity: 0.7 },
  loadingContainer: { flexDirection: 'row', alignItems: 'center' },
  primaryButtonText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
  disclaimerBox: {
    marginTop: 32, padding: 14,
    backgroundColor: Colors.white, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  disclaimerText: { fontSize: 11, lineHeight: 17, color: Colors.textMuted },
});
