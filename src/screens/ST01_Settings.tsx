/**
 * ST01_Settings — 설정/마이페이지 화면
 * Lock 3: users 테이블 SELECT only (profile 표시)
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, Alert,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Colors } from '../constants/colors';
import { ARCHETYPE_DEFINITIONS } from '../constants/archetype';
import type { User } from '../types/database';

const APP_VERSION = '1.0.0 (S1)';

export default function ST01_Settings() {
  const { user: authUser, signOut } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);

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

        {/* 구독 관리 — S2 준비 중 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>구독</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>현재 플랜</Text>
            <Text style={styles.rowValue}>무료 체험</Text>
          </View>
          <View style={[styles.row, styles.rowDisabled]}>
            <Text style={styles.rowLabelMuted}>구독 관리</Text>
            <Text style={styles.rowBadge}>S2 준비 중</Text>
          </View>
        </View>

        {/* 알림 설정 — S2 준비 중 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>알림</Text>
          <View style={[styles.row, styles.rowDisabled]}>
            <Text style={styles.rowLabelMuted}>일지 작성 리마인더</Text>
            <Text style={styles.rowBadge}>S2 준비 중</Text>
          </View>
          <View style={[styles.row, styles.rowDisabled]}>
            <Text style={styles.rowLabelMuted}>FOMO 경보 알림</Text>
            <Text style={styles.rowBadge}>S2 준비 중</Text>
          </View>
        </View>

        {/* 재진단 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>편향 진단</Text>
          <View style={[styles.row, styles.rowDisabled]}>
            <Text style={styles.rowLabelMuted}>재진단 요청</Text>
            <Text style={styles.rowBadge}>S2 준비 중</Text>
          </View>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surfaceBg },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary, marginBottom: 20 },
  card: {
    backgroundColor: Colors.white, borderRadius: 16,
    padding: 24, alignItems: 'center', marginBottom: 24,
    borderWidth: 1, borderColor: Colors.border,
  },
  avatarCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: 26, fontWeight: '700', color: Colors.white },
  displayName: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  email: { fontSize: 13, color: Colors.textMuted, marginBottom: 10 },
  archetypeBadge: {
    backgroundColor: Colors.primary + '15',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5,
  },
  archetypeText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  section: {
    backgroundColor: Colors.white, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: 16, overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 12, fontWeight: '600', color: Colors.textMuted,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6,
    textTransform: 'uppercase', letterSpacing: 0.5,
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
  rowBadge: {
    fontSize: 11, fontWeight: '600', color: Colors.primary,
    backgroundColor: Colors.primary + '12',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  signOutBtn: {
    marginTop: 8, padding: 16, borderRadius: 12,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center',
  },
  signOutText: { fontSize: 15, fontWeight: '600', color: Colors.error },
});
