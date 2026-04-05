/**
 * H01 — Home Dashboard (S1 업데이트)
 * Lock 3: SELECT only — discipline_logs, coaching_cards, principles, users
 * Lock 6: coaching_cards 표시 시 disclaimer 포함
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/colors';
import { getDisciplineColor, getDisciplineMessage } from '../constants/discipline';
import { ARCHETYPE_DEFINITIONS } from '../constants/archetype';
import DisciplineScoreBadge from '../components/DisciplineScoreBadge';
import TodayPrincipleCard from '../components/TodayPrincipleCard';
import type { User, Principle, DisciplineLog, CoachingCard } from '../types/database';
import type { MainStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

export default function H01_Home() {
  const navigation = useNavigation<Nav>();
  const { user: authUser, signOut } = useAuth();

  const [profile, setProfile] = useState<User | null>(null);
  const [principles, setPrinciples] = useState<Principle[]>([]);
  const [disciplineLog, setDisciplineLog] = useState<DisciplineLog | null>(null);
  const [coachingCard, setCoachingCard] = useState<CoachingCard | null>(null);
  const [hasJournal, setHasJournal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const fetchData = useCallback(async () => {
    if (!authUser) return;

    const [profileRes, principlesRes, disciplineRes, coachingRes, journalRes] = await Promise.all([
      supabase.from('users').select('*').eq('id', authUser.id).single(),
      supabase.from('principles').select('*').eq('user_id', authUser.id).eq('is_active', true).order('sort_order'),
      supabase.from('discipline_logs').select('*').eq('user_id', authUser.id).eq('log_date', today).single(),
      supabase.from('coaching_cards').select('*').eq('user_id', authUser.id).eq('card_date', today).single(),
      supabase.from('investment_journals').select('id').eq('user_id', authUser.id).eq('journal_date', today).single(),
    ]);

    if (profileRes.data) setProfile(profileRes.data as User);
    if (principlesRes.data) setPrinciples(principlesRes.data as Principle[]);
    setDisciplineLog(disciplineRes.data as DisciplineLog | null);
    setCoachingCard(coachingRes.data as CoachingCard | null);
    setHasJournal(!!journalRes.data);
  }, [authUser, today]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const archetypeDef = ARCHETYPE_DEFINITIONS.find(
    d => d.key === profile?.coaching_archetype
  );

  // 당일 discipline_logs 점수 우선, 없으면 users.discipline_score
  const displayScore = disciplineLog?.total_score ?? profile?.discipline_score ?? 0;

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
          score={displayScore}
          streak={profile?.current_streak ?? 0}
        />

        {/* 코칭 카드 (당일 있을 때만 표시) */}
        {coachingCard && (
          <View style={styles.coachingCard}>
            <Text style={styles.coachingTitle}>오늘의 코칭</Text>
            <Text style={styles.coachingContent}>{coachingCard.content}</Text>
            <Text style={styles.coachingDisclaimer} numberOfLines={2}>
              {/* Lock 6: 면책 문구 표시 */}
              [중요 고지사항] 본 내용은 투자 행동 패턴의 자기 인식을 위한 교육적 도구로, 투자 권유가 아닙니다.
            </Text>
          </View>
        )}

        {/* Principles */}
        <View style={styles.section}>
          <TodayPrincipleCard principles={principles} />
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>빠른 액션</Text>
          <View style={styles.actions}>
            <ActionButton
              label="일지 작성"
              sublabel="오늘의 투자 기록"
              onPress={() => navigation.navigate('JournalCreate')}
            />
            <ActionButton
              label="원칙 관리"
              sublabel="투자 원칙 수정"
              onPress={() => navigation.navigate('PrincipleManage')}
            />
          </View>

          {/* 오늘 일지 보기 버튼 (일지 작성 후에만 표시) */}
          {hasJournal && (
            <TouchableOpacity
              style={styles.viewJournalBtn}
              onPress={() => navigation.navigate('JournalView', { date: today })}
            >
              <Text style={styles.viewJournalText}>오늘 일지 보기</Text>
              {disciplineLog && (
                <Text style={[styles.viewJournalScore, { color: getDisciplineColor(disciplineLog.total_score) }]}>
                  {disciplineLog.total_score}점 · {getDisciplineMessage(disciplineLog.total_score)}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
          <Text style={styles.signOutText}>로그아웃</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionButton({ label, sublabel, onPress }: {
  label: string;
  sublabel: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.actionCard} onPress={onPress}>
      <Text style={styles.actionLabel}>{label}</Text>
      <Text style={styles.actionSublabel}>{sublabel}</Text>
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
  // Coaching Card
  coachingCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  coachingTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  coachingContent: {
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 22,
    marginBottom: 10,
  },
  coachingDisclaimer: {
    fontSize: 10,
    color: Colors.textMuted,
    lineHeight: 14,
  },
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
  actionLabel: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  actionSublabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
  // View Journal Button
  viewJournalBtn: {
    marginTop: 10,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.primary,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewJournalText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  viewJournalScore: {
    fontSize: 13,
    fontWeight: '600',
  },
  signOutButton: {
    alignItems: 'center', paddingVertical: 12, marginTop: 8,
  },
  signOutText: { fontSize: 14, color: Colors.textMuted },
});
