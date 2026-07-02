/**
 * ST01_Settings — 설정/마이페이지 화면
 * Lock 3: users 테이블 SELECT only (profile 표시)
 * S2: 구독 상태 실시간 표시 + SubscriptionScreen 연결
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, Alert, Linking, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Colors } from '../constants/colors';
import { Radius, Shadow } from '../constants/theme';
import { ARCHETYPE_DEFINITIONS } from '../constants/archetype';
import { useSubscription } from '../hooks/useSubscription';
import type { User } from '../types/database';
import type { MainStackParamList } from '../navigation/types';

// G2: 법적 문서 URL (Jerry: 정식 도메인 확정 후 교체)
const LEGAL_LINKS = {
  terms: 'https://invit.app/terms',
  privacy: 'https://invit.app/privacy',
  oss: 'https://invit.app/oss',
} as const;

type Nav = NativeStackNavigationProp<MainStackParamList>;

const APP_VERSION = '1.0.0 (S2)';

export default function ST01_Settings() {
  const navigation = useNavigation<Nav>();
  const { user: authUser, signOut } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { featureEnabled, isPremium, isTrialActive, trialDaysRemaining, loading: subLoading } = useSubscription();

  useEffect(() => {
    if (!authUser) return;
    supabase
      .from('users')
      .select('display_name, coaching_archetype, created_at')
      .eq('id', authUser.id)
      .single()
      .then(({ data }) => setProfile(data as User | null));
  }, [authUser]);

  const archetypeDef = profile?.coaching_archetype
    ? ARCHETYPE_DEFINITIONS.find((a) => a.key === profile.coaching_archetype) ?? null
    : null;

  const handleSignOut = () => {
    Alert.alert('로그아웃', '로그아웃 하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', style: 'destructive', onPress: signOut },
    ]);
  };

  // G1 — 회원 탈퇴 (2단계 확인, delete-account EF 호출)
  const handleDeleteAccount = () => {
    Alert.alert(
      '회원 탈퇴',
      '탈퇴 시 모든 투자 일지·원칙·코칭 이력이 삭제됩니다. 복구할 수 없습니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '탈퇴 진행',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              '정말 탈퇴하시겠습니까?',
              '이 작업은 되돌릴 수 없습니다.',
              [
                { text: '취소', style: 'cancel' },
                {
                  text: '탈퇴 확인',
                  style: 'destructive',
                  onPress: confirmDelete,
                },
              ],
            );
          },
        },
      ],
    );
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke('delete-account', {
        body: { confirm: 'DELETE' },
      });
      if (error) throw error;
      // 탈퇴 성공 — Auth 세션이 무효화되어 AuthContext가 자동으로 로그아웃 상태로 전환
    } catch (e) {
      setDeleting(false);
      Alert.alert('탈퇴 실패', '잠시 후 다시 시도해주세요.');
      console.error('[ST01] delete-account failed:', e);
    }
  };

  // 구독 상태 텍스트
  const subscriptionStatusText = (() => {
    if (!featureEnabled || subLoading) return '무료 체험';
    if (isPremium && !isTrialActive) return '프리미엄 구독 중';
    if (isTrialActive) return `무료 체험 ${trialDaysRemaining}일 남음`;
    return '무료 (체험 종료)';
  })();

  const subscriptionStatusColor = (() => {
    if (!featureEnabled || subLoading) return Colors.textMuted;
    if (isPremium && !isTrialActive) return Colors.success;
    if (isTrialActive) return Colors.primary;
    return Colors.warning;
  })();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
      >
        <Text style={styles.title}>설정</Text>

        {/* 프로필 카드 */}
        <View style={styles.card}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {profile?.display_name?.charAt(0)?.toUpperCase() ?? '?'}
            </Text>
          </View>
          <Text style={styles.displayName}>
            {profile?.display_name ?? authUser?.email ?? '–'}
          </Text>
          <Text style={styles.email}>{authUser?.email}</Text>
          {archetypeDef && (
            <View style={styles.archetypeBadge}>
              <Text style={styles.archetypeText}>
                {archetypeDef.nameKo ?? profile?.coaching_archetype}
              </Text>
            </View>
          )}
        </View>

        {/* 구독 관리 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>구독</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>현재 플랜</Text>
            <Text style={[styles.rowValue, { color: subscriptionStatusColor, fontWeight: '600' }]}>
              {subscriptionStatusText}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('Subscription', undefined)}
          >
            <Text style={styles.rowLabel}>구독 관리</Text>
            <Text style={styles.rowChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* 알림 설정 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>알림</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>FOMO 경보 알림</Text>
            <Text style={styles.rowValue}>활성화됨</Text>
          </View>
          <View style={[styles.row, styles.rowDisabled]}>
            <Text style={styles.rowLabelMuted}>일지 작성 리마인더</Text>
            <Text style={styles.rowBadge}>준비 중</Text>
          </View>
        </View>

        {/* 재진단 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>편향 진단</Text>
          <View style={[styles.row, styles.rowDisabled]}>
            <Text style={styles.rowLabelMuted}>재진단 요청</Text>
            <Text style={styles.rowBadge}>준비 중</Text>
          </View>
        </View>

        {/* G2 — 법적 고지 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>법적 고지</Text>
          <TouchableOpacity
            style={styles.row}
            onPress={() => Linking.openURL(LEGAL_LINKS.terms)}
          >
            <Text style={styles.rowLabel}>이용약관</Text>
            <Text style={styles.rowChevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.row}
            onPress={() => Linking.openURL(LEGAL_LINKS.privacy)}
          >
            <Text style={styles.rowLabel}>개인정보처리방침</Text>
            <Text style={styles.rowChevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.row}
            onPress={() => Linking.openURL(LEGAL_LINKS.oss)}
          >
            <Text style={styles.rowLabel}>오픈소스 라이선스</Text>
            <Text style={styles.rowChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* 앱 정보 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>앱 정보</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>버전</Text>
            <Text style={styles.rowValue}>{APP_VERSION}</Text>
          </View>
        </View>

        {/* 로그아웃 */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>로그아웃</Text>
        </TouchableOpacity>

        {/* G1 — 회원 탈퇴 */}
        <TouchableOpacity
          style={[styles.deleteAccountBtn, deleting && { opacity: 0.5 }]}
          onPress={handleDeleteAccount}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator color={Colors.textMuted} size="small" />
          ) : (
            <Text style={styles.deleteAccountText}>회원 탈퇴</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surfaceBg },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 110 },
  title: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary, marginBottom: 20 },
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: 24, alignItems: 'center', marginBottom: 24,
    borderWidth: 1, borderColor: Colors.border,
    ...Shadow.card,
  },
  avatarCircle: {
    width: 64, height: 64, borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: 26, fontWeight: '700', color: Colors.white },
  displayName: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  email: { fontSize: 13, color: Colors.textMuted, marginBottom: 10 },
  archetypeBadge: {
    backgroundColor: Colors.primary + '15',
    borderRadius: Radius.xl, paddingHorizontal: 14, paddingVertical: 5,
  },
  archetypeText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  section: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: 16, overflow: 'hidden', ...Shadow.card,
  },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  rowDisabled: { opacity: 0.6 },
  rowLabel: { fontSize: 15, color: Colors.textPrimary },
  rowLabelMuted: { fontSize: 15, color: Colors.textSecondary },
  rowValue: { fontSize: 15, color: Colors.textMuted },
  rowChevron: { fontSize: 20, color: Colors.textMuted },
  rowBadge: {
    fontSize: 11, fontWeight: '600', color: Colors.primary,
    backgroundColor: Colors.primary + '12',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.xs,
  },
  signOutBtn: {
    marginTop: 8, padding: 16, borderRadius: Radius.md,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center',
  },
  signOutText: { fontSize: 15, fontWeight: '600', color: Colors.error },
  deleteAccountBtn: {
    marginTop: 12, marginBottom: 8, padding: 16, borderRadius: Radius.md,
    backgroundColor: Colors.white,
    borderWidth: 1, borderColor: Colors.error + '60',
    alignItems: 'center',
  },
  deleteAccountText: { fontSize: 15, fontWeight: '400', color: Colors.textMuted },
});
