/**
 * H01 — Home Dashboard
 * Lock 3: SELECT only (클라이언트에서 읽기만). DB 쓰기는 Edge Function 전용.
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, RefreshControl,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { User, Principle } from '../types/database';
import { ARCHETYPE_DEFINITIONS } from '../constants/archetype';
import DisciplineScoreBadge from '../components/DisciplineScoreBadge';
import TodayPrincipleCard from '../components/TodayPrincipleCard';
import { Colors } from '../constants/colors';

export default function H01_Home() {
  const { user: authUser, signOut } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);
  const [principles, setPrinciples] = useState<Principle[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    if (!authUser) return;

    const [profileRes, principlesRes] = await Promise.all([
      supabase.from('users').select('*').eq('id', authUser.id).single(),
      supabase.from('principles').select('*').eq('user_id', authUser.id).order('sort_order'),
    ]);

    if (profileRes.data) setProfile(profileRes.data as User);
    if (principlesRes.data) setPrinciples(principlesRes.data as Principle[]);
  };

  useEffect(() => {
    fetchData();
  }, [authUser]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const archetypeDef = ARCHETYPE_DEFINITIONS.find(
    (d) => d.key === profile?.coaching_archetype
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              {profile?.display_name || authUser?.email?.split('@')[0] || '투자자'}님
            </Text>
            <Text style={styles.date}>
              {new Date().toLocaleDateString('ko-KR', {
                year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
              })}
            </Text>
          </View>
        </View>

        {/* Archetype Badge */}
        {archetypeDef && (
          <View style={[styles.archetypeBadge, { backgroundColor: archetypeDef.color + '12' }]}>
            <Text style={[styles.archetypeText, { color: archetypeDef.color }]}>
              {archetypeDef.nameKo}
            </Text>
          </View>
        )}

        {/* Discipline Score */}
        <DisciplineScoreBadge
          score={profile?.discipline_score ?? 0}
          streak={profile?.current_streak ?? 0}
        />

        {/* Principles */}
        <View style={styles.section}>
          <TodayPrincipleCard principles={principles} />
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>빠른 액션</Text>
          <View style={styles.actions}>
            <ActionButton label="일지 작성" sublabel="오늘의 투자 기록" disabled />
            <ActionButton label="원칙 관리" sublabel="투자 원칙 수정" disabled />
          </View>
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
          <Text style={styles.signOutText}>로그아웃</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionButton({ label, sublabel, disabled }: {
  label: string; sublabel: string; disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionCard, disabled && styles.actionDisabled]}
      disabled={disabled}
    >
      <Text style={styles.actionLabel}>{label}</Text>
      <Text style={styles.actionSublabel}>{sublabel}</Text>
      {disabled && <Text style={styles.comingSoon}>S1 Sprint</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surfaceBg },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, gap: 16 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 4,
  },
  greeting: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary },
  date: { fontSize: 13, color: Colors.textMuted, marginTop: 4 },
  archetypeBadge: {
    alignSelf: 'flex-start', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  archetypeText: { fontSize: 14, fontWeight: '600' },
  section: {},
  sectionTitle: {
    fontSize: 13, fontWeight: '600', color: Colors.textMuted,
    marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  actions: { flexDirection: 'row', gap: 12 },
  actionCard: {
    flex: 1, backgroundColor: Colors.white, borderRadius: 12,
    padding: 16, borderWidth: 1, borderColor: Colors.border,
  },
  actionDisabled: { opacity: 0.5 },
  actionLabel: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  actionSublabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  comingSoon: {
    fontSize: 10, color: Colors.primary, fontWeight: '600',
    marginTop: 8, textTransform: 'uppercase',
  },
  signOutButton: {
    alignItems: 'center', paddingVertical: 12, marginTop: 8,
  },
  signOutText: { fontSize: 14, color: Colors.textMuted },
});
