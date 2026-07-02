/**
 * S01 — Welcome Screen (온보딩 진입)
 * 독자 런칭 (0617) — 한경TV 공동브랜딩 제거
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors } from '../constants/colors';
import { Radius, Shadow } from '../constants/theme';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

const FEATURES = [
  { emoji: '🧠', title: '투자 편향 진단', description: '7문항으로 나의 심리 패턴을 파악합니다' },
  { emoji: '📓', title: '투자 일지 & 규율 점수', description: '매일의 원칙 준수를 수치로 추적합니다' },
  { emoji: '✨', title: 'AI 맞춤 코칭', description: '아키타입에 맞는 행동 코칭을 제공합니다' },
];

export default function S01_Welcome({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        {/* 히어로 */}
        <View style={styles.hero}>
          <View style={styles.logoBadge}>
            <Text style={styles.logo}>INVIT</Text>
          </View>
          <Text style={styles.tagline}>투자 습관을 바꾸는{'\n'}행동 코칭 플랫폼</Text>
          <View style={styles.pillBadge}>
            <Text style={styles.pillText}>행동 경제학 기반 · 비투자자문</Text>
          </View>
        </View>

        {/* 기능 소개 */}
        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.featureItem}>
              <Text style={styles.featureEmoji}>{f.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* CTA */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('SignUp')}
          >
            <Text style={styles.primaryButtonText}>지금 시작하기</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('SignIn')}
          >
            <Text style={styles.secondaryButtonText}>이미 계정이 있으신가요?  <Text style={{ color: Colors.primary, fontWeight: '600' }}>로그인</Text></Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surfaceBg,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    paddingTop: 40,
    paddingBottom: 32,
  },

  // 히어로
  hero: {
    alignItems: 'center',
    gap: 14,
  },
  logoBadge: {
    width: 80,
    height: 80,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.elevated,
  },
  logo: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 3,
  },
  tagline: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 32,
  },
  pillBadge: {
    backgroundColor: Colors.primary + '12',
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.primary + '25',
  },
  pillText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },

  // 기능 소개
  features: {
    gap: 10,
  },
  featureItem: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    ...Shadow.card,
  },
  featureEmoji: { fontSize: 28 },
  featureTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },

  // CTA
  actions: {
    gap: 10,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    ...Shadow.elevated,
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
});
