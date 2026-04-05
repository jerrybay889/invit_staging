/**
 * S01 — Welcome Screen (온보딩 진입)
 * 앱 소개 + "시작하기" CTA
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors } from '../constants/colors';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function S01_Welcome({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.logo}>INVIT</Text>
          <Text style={styles.tagline}>투자 습관을 바꾸는{'\n'}행동 코칭 플랫폼</Text>
        </View>

        <View style={styles.features}>
          <FeatureItem
            title="투자 편향 진단"
            description="7문항으로 나의 투자 성향을 파악합니다"
          />
          <FeatureItem
            title="규율 점수 관리"
            description="매일의 투자 원칙 준수를 추적합니다"
          />
          <FeatureItem
            title="AI 코칭"
            description="맞춤형 행동 코칭으로 습관을 개선합니다"
          />
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('SignUp')}
          >
            <Text style={styles.primaryButtonText}>시작하기</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('SignIn')}
          >
            <Text style={styles.secondaryButtonText}>이미 계정이 있으신가요? 로그인</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

function FeatureItem({ title, description }: { title: string; description: string }) {
  return (
    <View style={styles.featureItem}>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDesc}>{description}</Text>
    </View>
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
    paddingTop: 60,
    paddingBottom: 40,
  },
  hero: {
    alignItems: 'center',
  },
  logo: {
    fontSize: 40,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 4,
  },
  tagline: {
    fontSize: 18,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 26,
  },
  features: {
    gap: 16,
  },
  featureItem: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  actions: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
});
