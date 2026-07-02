/**
 * H01 — Home Dashboard (v2.1 업그레이드)
 * Lock 3: SELECT only — discipline_logs, coaching_cards, principles, users, fomo_alerts
 * Lock 6: coaching_cards 표시 시 disclaimer 포함
 * v2.1: 장 시간대 타임라인 배너 + D-Score StatCard + 시황 카드 개선
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/colors';
import { Radius, Shadow, Spacing } from '../constants/theme';
import { getDisciplineColor, getDisciplineMessage } from '../constants/discipline';
import { ARCHETYPE_DEFINITIONS } from '../constants/archetype';
import TodayPrincipleCard from '../components/TodayPrincipleCard';
import FomoAlertBanner from '../components/FomoAlertBanner';
import { useFomoAlert } from '../hooks/useFomoAlert';
import type { User, Principle, DisciplineLog, CoachingCard, DailyBriefing } from '../types/database';
import type { MainStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

// ── 장 시간대 판단 (KST 기준) ──────────────────────────────────────────
function getKSTMarketStatus() {
  const now = new Date();
  const kstMins = (now.getUTCHours() * 60 + now.getUTCMinutes() + 9 * 60) % (24 * 60);
  const day = new Date(now.getTime() + 9 * 60 * 60 * 1000).getUTCDay();

  if (day === 0 || day === 6) {
    return { label: '휴장일', color: Colors.textFaint, dot: '○', isOpen: false };
  }
  if (kstMins >= 8 * 60 + 30 && kstMins < 9 * 60) {
    return { label: '개장 전 동시호가', color: Colors.warning, dot: '⏱', isOpen: false };
  }
  if (kstMins >= 9 * 60 && kstMins < 15 * 60 + 20) {
    return { label: '장중', color: Colors.success, dot: '●', isOpen: true };
  }
  if (kstMins >= 15 * 60 + 20 && kstMins < 15 * 60 + 40) {
    return { label: '장마감 동시호가', color: Colors.textSecondary, dot: '⏱', isOpen: false };
  }
  if (kstMins >= 15 * 60 + 40 && kstMins < 18 * 60) {
    return { label: '시간외 매매', color: Colors.textMuted, dot: '○', isOpen: false };
  }
  return { label: '장외', color: Colors.textFaint, dot: '○', isOpen: false };
}

function MarketStatusBar() {
  const m = getKSTMarketStatus();
  return (
    <View style={[msb.bar, { borderColor: m.color + '30' }]}>
      <View style={[msb.dot, { backgroundColor: m.color }]} />
      <Text style={[msb.label, { color: m.color }]}>{m.label}</Text>
      <Text style={msb.exchange}>KOSPI · KOSDAQ</Text>
    </View>
  );
}

const msb = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.sm,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: Colors.surface,
  },
  dot: { width: 7, height: 7, borderRadius: Radius.full },
  label: { fontSize: 13, fontWeight: '600', flex: 1 },
  exchange: { fontSize: 11, color: Colors.textFaint },
});

// ── D-Score 카드 ────────────────────────────────────────────────────────
function DScoreCard({ score, streak }: { score: number; streak: number }) {
  const color = getDisciplineColor(score);
  const message = getDisciplineMessage(score);

  const scoreBarWidth = `${score}%` as any;

  return (
    <View style={dsc.card}>
      <Text style={dsc.labelText}>오늘의 규율 점수</Text>
      <View style={dsc.mainRow}>
        <Text style={[dsc.score, { color }]}>{score}</Text>
        <View style={dsc.right}>
          <Text style={[dsc.message, { color }]}>{message}</Text>
          {streak > 0 && (
            <View style={dsc.streakBadge}>
              <Text style={dsc.streakText}>🔥 {streak}일 연속</Text>
            </View>
          )}
        </View>
      </View>
      <View style={dsc.bar}>
        <View style={[dsc.barFill, { width: scoreBarWidth, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const dsc = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.card,
    gap: 12,
  },
  labelText: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  mainRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  score: { fontSize: 52, fontWeight: '800', lineHeight: 56 },
  right: { flex: 1, gap: 6 },
  message: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  streakBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.warning + '14',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  streakText: { fontSize: 12, fontWeight: '600', color: Colors.warning },
  bar: {
    height: 4, backgroundColor: Colors.border, borderRadius: Radius.full, overflow: 'hidden',
  },
  barFill: { height: 4, borderRadius: Radius.full },
});

// ── 메인 컴포넌트 ────────────────────────────────────────────────────────
export default function H01_Home() {
  const navigation = useNavigation<Nav>();
  const { user: authUser } = useAuth();
  const { alert: fomoAlert, dismissAlert } = useFomoAlert();

  const [profile, setProfile] = useState<User | null>(null);
  const [principles, setPrinciples] = useState<Principle[]>([]);
  const [disciplineLog, setDisciplineLog] = useState<DisciplineLog | null>(null);
  const [coachingCard, setCoachingCard] = useState<CoachingCard | null>(null);
  const [hasJournal, setHasJournal] = useState(false);
  const [recentJournals, setRecentJournals] = useState<any[]>([]);
  const [todayBriefing, setTodayBriefing] = useState<DailyBriefing | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const fetchData = useCallback(async () => {
    if (!authUser) return;

    const [profileRes, principlesRes, disciplineRes, coachingRes, journalRes, recentRes, briefingRes] = await Promise.all([
      supabase.from('users').select('*').eq('id', authUser.id).single(),
      supabase.from('principles').select('*').eq('user_id', authUser.id).eq('is_active', true).order('sort_order'),
      supabase.from('discipline_logs').select('*').eq('user_id', authUser.id).eq('log_date', today).single(),
      supabase.from('coaching_cards').select('*').eq('user_id', authUser.id).eq('card_date', today).single(),
      supabase.from('investment_journals').select('id').eq('user_id', authUser.id).eq('journal_date', today).single(),
      supabase.from('investment_journals').select('journal_date, emotion_checkin, trade_action, trade_rationale').eq('user_id', authUser.id).order('journal_date', { ascending: false }).limit(3),
      supabase.from('daily_briefings').select('*').eq('briefing_date', today).not('published_at', 'is', null).single(),
    ]);

    if (profileRes.data) setProfile(profileRes.data as User);
    if (principlesRes.data) setPrinciples(principlesRes.data as Principle[]);
    setDisciplineLog(disciplineRes.data as DisciplineLog | null);
    setCoachingCard(coachingRes.data as CoachingCard | null);
    setHasJournal(!!journalRes.data);
    setRecentJournals(recentRes.data ?? []);
    setTodayBriefing(briefingRes.data as DailyBriefing | null);
  }, [authUser, today]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const archetypeDef = ARCHETYPE_DEFINITIONS.find(d => d.key === profile?.coaching_archetype);
  const displayScore = disciplineLog?.total_score ?? profile?.discipline_score ?? 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* 헤더 */}
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
          {archetypeDef && (
            <View style={[styles.archetypeBadge, { backgroundColor: archetypeDef.color + '14' }]}>
              <Text style={[styles.archetypeText, { color: archetypeDef.color }]}>
                {archetypeDef.nameKo}
              </Text>
            </View>
          )}
        </View>

        {/* 장 시간대 배너 */}
        <MarketStatusBar />

        {/* FOMO 경보 배너 */}
        {fomoAlert && (
          <FomoAlertBanner alert={fomoAlert} onDismiss={dismissAlert} />
        )}

        {/* D-Score 카드 */}
        <DScoreCard score={displayScore} streak={profile?.current_streak ?? 0} />

        {/* 코칭 카드 */}
        <View style={[styles.coachingCard, coachingCard ? styles.coachingCardActive : undefined]}>
          <Text style={styles.coachingLabel}>오늘의 코칭</Text>
          {coachingCard ? (
            <>
              <Text style={styles.coachingContent}>{coachingCard.content}</Text>
              <Text style={styles.coachingDisclaimer} numberOfLines={2}>
                {/* Lock 6 */}
                [중요 고지사항] 본 내용은 투자 행동 패턴의 자기 인식을 위한 교육적 도구로, 투자 권유가 아닙니다.
              </Text>
            </>
          ) : (
            <Text style={styles.coachingEmpty}>
              오늘 일지를 작성하면 맞춤 코칭이 준비됩니다.
            </Text>
          )}
        </View>

        {/* 시황 브리핑 */}
        {todayBriefing && (
          <View style={styles.briefingCard}>
            <Text style={styles.briefingLabel}>오늘의 시황</Text>
            <Text style={styles.briefingTitle}>{todayBriefing.brief_title}</Text>
            <Text style={styles.briefingSummary}>{todayBriefing.summary}</Text>
            {todayBriefing.bias_warning ? (
              <View style={styles.briefingWarn}>
                <Text style={styles.briefingWarnText}>⚠ {todayBriefing.bias_warning}</Text>
              </View>
            ) : null}
            {todayBriefing.principle_hint ? (
              <Text style={styles.briefingHint}>💡 {todayBriefing.principle_hint}</Text>
            ) : null}
          </View>
        )}

        {/* 오늘의 원칙 */}
        <View>
          <TodayPrincipleCard principles={principles} />
        </View>

        {/* 최근 일지 */}
        {recentJournals.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>최근 일지</Text>
            {recentJournals.slice(0, 3).map((j, i) => (
              <TouchableOpacity
                key={i}
                style={styles.journalCard}
                onPress={() => navigation.navigate('JournalView', { date: j.journal_date })}
              >
                <Text style={styles.journalEmoji}>
                  {(['😰', '😟', '😐', '😊', '😄'] as const)[Math.max(0, Math.min(4, (j.emotion_checkin ?? 3) - 1))]}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.journalDate}>
                    {new Date(j.journal_date + 'T00:00:00').toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })}
                  </Text>
                  <Text style={styles.journalMeta}>
                    {j.trade_action === 'buy' ? '매수' : j.trade_action === 'sell' ? '매도' : '매매 없음'}
                    {j.trade_rationale ? ' · 근거 있음' : ''}
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* 빠른 액션 */}
        <View>
          <Text style={styles.sectionTitle}>빠른 액션</Text>
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('JournalCreate', {})}
            >
              <Text style={styles.actionEmoji}>📓</Text>
              <Text style={styles.actionLabel}>일지 작성</Text>
              <Text style={styles.actionSub}>오늘의 투자 기록</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('PrincipleManage', undefined)}
            >
              <Text style={styles.actionEmoji}>📋</Text>
              <Text style={styles.actionLabel}>원칙 관리</Text>
              <Text style={styles.actionSub}>투자 원칙 수정</Text>
            </TouchableOpacity>
          </View>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surfaceBg },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 88, gap: Spacing.md },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greeting: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  date: { fontSize: 12, color: Colors.textMuted, marginTop: 3 },
  archetypeBadge: {
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  archetypeText: { fontSize: 12, fontWeight: '600' },

  coachingCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 3,
    borderLeftColor: Colors.divider,
    ...Shadow.card,
  },
  coachingCardActive: { borderLeftColor: Colors.primary },
  coachingLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.primary,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
  },
  coachingContent: { fontSize: 15, color: Colors.textPrimary, lineHeight: 22, marginBottom: 10 },
  coachingDisclaimer: { fontSize: 10, color: Colors.textFaint, lineHeight: 14 },
  coachingEmpty: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, fontStyle: 'italic' },

  briefingCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 3,
    borderLeftColor: Colors.warning,
    ...Shadow.card,
  },
  briefingLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.warning,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6,
  },
  briefingTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  briefingSummary: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  briefingWarn: {
    marginTop: 10, backgroundColor: Colors.warning + '12',
    borderRadius: Radius.sm, padding: 10,
  },
  briefingWarnText: { fontSize: 13, color: Colors.warning, lineHeight: 18, fontWeight: '500' },
  briefingHint: { marginTop: 8, fontSize: 13, color: Colors.textSecondary, lineHeight: 18, fontStyle: 'italic' },

  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
  },

  journalCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    padding: 12, borderWidth: 1, borderColor: Colors.border,
    marginBottom: 8, ...Shadow.card,
  },
  journalEmoji: { fontSize: 22, marginRight: 10 },
  journalDate: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  journalMeta: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  chevron: { fontSize: 18, color: Colors.textFaint },

  actions: { flexDirection: 'row', gap: 12 },
  actionCard: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, ...Shadow.card,
  },
  actionEmoji: { fontSize: 24, marginBottom: 8 },
  actionLabel: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  actionSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 3 },

  viewJournalBtn: {
    marginTop: 10, backgroundColor: Colors.surface, borderRadius: Radius.md,
    padding: 14, borderWidth: 1, borderColor: Colors.primary,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  viewJournalText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  viewJournalScore: { fontSize: 13, fontWeight: '600' },
});
