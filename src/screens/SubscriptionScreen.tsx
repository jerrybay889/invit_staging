/**
 * SubscriptionScreen — 14일 Reverse Trial + 구독 관리 화면
 * Lock 2: feature_flags.subscription = true 시에만 표시
 *
 * 상태별 UI:
 *   trial 중    → "남은 무료 체험 N일" + 구독 전환 버튼
 *   trial 종료  → "프리미엄 기능 잠금" + 구독 버튼 (₩9,900/월)
 *   구독 중     → "프리미엄 이용 중" + 구독 취소 안내
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../constants/colors';
import { useSubscription } from '../hooks/useSubscription';

const FEATURES = [
  { icon: '📊', text: '투자 편향 진단 + 아키타입 코칭' },
  { icon: '📓', text: '무제한 일지 작성 + 규율 점수 추적' },
  { icon: '🚨', text: 'FOMO 경보 알림 (장 마감 자동 발송)' },
  { icon: '💡', text: 'AI 맞춤 코칭 카드 (매일 갱신)' },
  { icon: '📋', text: '투자 원칙 관리 (무제한)' },
];

export default function SubscriptionScreen() {
  const navigation = useNavigation();
  const {
    isPremium,
    isTrialActive,
    isSubscribed,
    trialDaysRemaining,
    loading,
    purchasing,
    purchasePremium,
    restorePurchases,
  } = useSubscription();

  const handlePurchase = async () => {
    const success = await purchasePremium();
    if (success) {
      Alert.alert('구독 완료', '프리미엄 구독이 시작되었습니다!', [
        { text: '확인', onPress: () => navigation.goBack() },
      ]);
    } else {
      Alert.alert('구독 실패', '결제에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const handleRestore = async () => {
    const success = await restorePurchases();
    Alert.alert(
      success ? '복원 완료' : '복원 실패',
      success
        ? '기존 구독이 복원되었습니다.'
        : '복원할 구독 정보를 찾을 수 없습니다.',
    );
  };

  const handleManageSubscription = () => {
    // iOS: App Store 구독 관리 / Android: Google Play 구독 관리
    const url = 'https://apps.apple.com/account/subscriptions';
    Linking.openURL(url).catch(() => {
      Alert.alert('안내', '앱 스토어에서 구독을 관리하세요.');
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: 60 }} color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll}>

        {/* 상태 배지 */}
        <View style={styles.statusBadgeWrap}>
          {isSubscribed ? (
            <View style={[styles.statusBadge, { backgroundColor: Colors.success + '15' }]}>
              <Text style={[styles.statusBadgeText, { color: Colors.success }]}>
                ✓ 프리미엄 이용 중
              </Text>
            </View>
          ) : isTrialActive ? (
            <View style={[styles.statusBadge, { backgroundColor: Colors.primary + '15' }]}>
              <Text style={[styles.statusBadgeText, { color: Colors.primary }]}>
                무료 체험 {trialDaysRemaining}일 남음
              </Text>
            </View>
          ) : (
            <View style={[styles.statusBadge, { backgroundColor: Colors.warning + '15' }]}>
              <Text style={[styles.statusBadgeText, { color: Colors.warning }]}>
                무료 체험 종료
              </Text>
            </View>
          )}
        </View>

        {/* 헤더 */}
        <Text style={styles.title}>INVIT 프리미엄</Text>
        <Text style={styles.subtitle}>
          {isSubscribed
            ? '모든 프리미엄 기능을 이용 중입니다.'
            : isTrialActive
            ? `무료 체험 종료 후 ₩9,900/월로 계속 이용하세요.`
            : '프리미엄을 구독하면 모든 기능을 이용할 수 있습니다.'}
        </Text>

        {/* 기능 목록 */}
        <View style={styles.featureList}>
          {FEATURES.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        {/* 가격 표시 (구독 중이 아닐 때) */}
        {!isSubscribed && (
          <View style={styles.priceCard}>
            <Text style={styles.price}>₩9,900</Text>
            <Text style={styles.pricePeriod}>/ 월 (부가세 포함)</Text>
            {isTrialActive && (
              <Text style={styles.trialNote}>
                무료 체험 {trialDaysRemaining}일 후 자동 과금
              </Text>
            )}
          </View>
        )}

        {/* CTA 버튼 */}
        {isSubscribed ? (
          <>
            <View style={styles.subscribedBanner}>
              <Text style={styles.subscribedText}>
                투자 원칙을 지키는 여정을 응원합니다 🎯
              </Text>
            </View>
            <TouchableOpacity
              style={styles.manageBtn}
              onPress={handleManageSubscription}
            >
              <Text style={styles.manageBtnText}>구독 관리 (스토어)</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.primaryBtn, purchasing && styles.primaryBtnDisabled]}
            onPress={handlePurchase}
            disabled={purchasing}
          >
            {purchasing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {isTrialActive ? '구독 시작하기' : '프리미엄 구독 ₩9,900/월'}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* 복원 버튼 */}
        <TouchableOpacity
          style={styles.restoreBtn}
          onPress={handleRestore}
          disabled={purchasing}
        >
          <Text style={styles.restoreBtnText}>기존 구독 복원</Text>
        </TouchableOpacity>

        {/* 이용약관 */}
        <Text style={styles.legalText}>
          구독은 현재 결제 기간이 끝나기 최소 24시간 전에 취소하지 않으면 자동 갱신됩니다.
          구독 관리 및 자동 갱신 해제는 구입 후 계정 설정에서 하실 수 있습니다.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surfaceBg },
  scroll: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 48 },

  statusBadgeWrap: { alignItems: 'center', marginBottom: 16 },
  statusBadge: {
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6,
  },
  statusBadgeText: { fontSize: 13, fontWeight: '700' },

  title: {
    fontSize: 28, fontWeight: '800', color: Colors.textPrimary,
    textAlign: 'center', marginBottom: 8,
  },
  subtitle: {
    fontSize: 14, color: Colors.textSecondary, textAlign: 'center',
    lineHeight: 22, marginBottom: 28,
  },

  featureList: {
    backgroundColor: Colors.white, borderRadius: 14,
    padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: Colors.border,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  featureIcon: { fontSize: 22, marginRight: 14, width: 28 },
  featureText: { flex: 1, fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },

  priceCard: {
    backgroundColor: Colors.primary + '08',
    borderRadius: 12, padding: 16,
    alignItems: 'center', marginBottom: 20,
    borderWidth: 1, borderColor: Colors.primary + '20',
  },
  price: { fontSize: 32, fontWeight: '800', color: Colors.primary },
  pricePeriod: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  trialNote: {
    fontSize: 12, color: Colors.warning, marginTop: 8, fontWeight: '500',
  },

  primaryBtn: {
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginBottom: 12,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  subscribedBanner: {
    backgroundColor: Colors.success + '10', borderRadius: 12,
    padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.success + '25',
    alignItems: 'center',
  },
  subscribedText: { fontSize: 14, color: Colors.success, fontWeight: '600', textAlign: 'center' },

  manageBtn: {
    borderWidth: 1.5, borderColor: Colors.primary,
    borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', marginBottom: 12,
  },
  manageBtnText: { color: Colors.primary, fontSize: 15, fontWeight: '600' },

  restoreBtn: { alignItems: 'center', paddingVertical: 10, marginBottom: 16 },
  restoreBtnText: { color: Colors.textSecondary, fontSize: 13 },

  legalText: {
    fontSize: 11, color: Colors.textMuted, textAlign: 'center',
    lineHeight: 16, marginTop: 8,
  },
});
