/**
 * IN01_Insights — 편향 분석 + 규율 트렌드 화면
 * Lock 3: bias_assessments, discipline_logs, coaching_cards SELECT only
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Colors } from '../constants/colors';
import { Radius, Shadow, Spacing } from '../constants/theme';
import { ARCHETYPE_DEFINITIONS } from '../constants/archetype';
import { getDisciplineColor, getDisciplineMessage } from '../constants/discipline';
import type {
  BiasAssessment, BiasAnswers, BiasFlags, DisciplineLog, CoachingCard, User,
} from '../types/database';

// ── 7 편향 메타 정보 ──────────────────────────────────────────────────────
const BIAS_META: {
  key: keyof BiasFlags;
  label: string;
  answerKey: keyof BiasAnswers;
  reversed?: boolean;
  threePoint?: boolean;
  color: string;
}[] = [
  { key: 'loss_aversion',    label: '손실회피',  answerKey: 'q1', color: Colors.warning },
  { key: 'fomo',             label: 'FOMO',      answerKey: 'q2', color: Colors.error },
  { key: 'overconfidence',   label: '과잉확신',  answerKey: 'q3', color: Colors.warning },
  { key: 'disposition',      label: '처분효과',  answerKey: 'q4', threePoint: true, color: Colors.error },
  { key: 'herding',          label: '군집행동',  answerKey: 'q5', color: Colors.warning },
  { key: 'present_bias',     label: '현재편향',  answerKey: 'q6', reversed: true,  color: Colors.warning },
  { key: 'confirmation',     label: '확증편향',  answerKey: 'q7', color: Colors.error },
];

// 0.0 ~ 1.0 사이의 편향 강도 (답변 기반)
function calcIntensity(meta: typeof BIAS_META[0], answers: BiasAnswers): number {
  const raw = answers[meta.answerKey] as number;
  if (meta.threePoint) {
    // q4: 1=최강편향, 2=중간, 3=없음 → 강도 = (3-raw)/2
    return (3 - raw) / 2;
  }
  if (meta.reversed) {
    // q6: 낮을수록 편향↑ → 강도 = (5-raw)/4
    return (5 - raw) / 4;
  }
  return (raw - 1) / 4;
}

function intensityColor(intensity: number): string {
  if (intensity < 0.34) return Colors.success;
  if (intensity < 0.67) return Colors.gold;
  return Colors.error;
}

// ── 규율 트렌드 색상 ──────────────────────────────────────────────────────
function barColor(score: number) {
  return getDisciplineColor(score);
}

// ── 날짜 포맷 ──────────────────────────────────────────────────────────────
function fmtDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function fmtMonth(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────
export default function IN01_Insights() {
  const { user: authUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState<BiasAssessment | null>(null);
  const [disciplineLogs, setDisciplineLogs] = useState<DisciplineLog[]>([]);
  const [coaching, setCoaching] = useState<CoachingCard | null>(null);
  const [journalCount30d, setJournalCount30d] = useState<number>(0);
  const [archetype, setArchetype] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!authUser) return;
    setLoading(true);
    const uid = authUser.id;
    const today = new Date();
    const ago14 = new Date(today); ago14.setDate(today.getDate() - 14);
    const ago30 = new Date(today); ago30.setDate(today.getDate() - 30);

    const [
      { data: assData },
      { data: logData },
      { data: cardData },
      { count: jCount },
      { data: userData },
    ] = await Promise.all([
      supabase.from('bias_assessments')
        .select('*')
        .eq('user_id', uid)
        .order('diagnosed_at', { ascending: false })
        .limit(1)
        .single(),
      supabase.from('discipline_logs')
        .select('log_date, total_score, journal_score, principle_score, emotion_score')
        .eq('user_id', uid)
        .gte('log_date', ago14.toISOString().split('T')[0])
        .order('log_date', { ascending: true }),
      supabase.from('coaching_cards')
        .select('content, card_date, source, archetype')
        .eq('user_id', uid)
        .order('card_date', { ascending: false })
        .limit(1)
        .single(),
      supabase.from('investment_journals')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', uid)
        .gte('journal_date', ago30.toISOString().split('T')[0]),
      supabase.from('users')
        .select('coaching_archetype')
        .eq('id', uid)
        .single(),
    ]);

    setAssessment(assData as BiasAssessment | null);
    setDisciplineLogs((logData as DisciplineLog[]) ?? []);
    setCoaching(cardData as CoachingCard | null);
    setJournalCount30d(jCount ?? 0);
    setArchetype((userData as Pick<User, 'coaching_archetype'> | null)?.coaching_archetype ?? null);
    setLoading(false);
  }, [authUser]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: 60 }} color={Colors.primary} />
      </SafeAreaView>
    );
  }

  const archetypeDef = archetype
    ? ARCHETYPE_DEFINITIONS.find((a) => a.key === archetype) ?? null
    : null;

  const avgScore = disciplineLogs.length
    ? Math.round(disciplineLogs.reduce((s, l) => s + l.total_score, 0) / disciplineLogs.length)
    : null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>분석</Text>

        {/* ── 편향 프로파일 ─────────────────────────────── */}
        {assessment ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>편향 프로파일</Text>
              <Text style={styles.cardMeta}>
                {fmtMonth(assessment.diagnosed_at.split('T')[0])} 진단
              </Text>
            </View>

            {/* 아키타입 배지 */}
            {archetypeDef && (
              <View style={[styles.archetypeBadge, { borderColor: archetypeDef.color + '40', backgroundColor: archetypeDef.color + '10' }]}>
                <Text style={[styles.archetypeLabel, { color: archetypeDef.color }]}>
                  {archetypeDef.nameKo}
                </Text>
                <Text style={styles.archetypeDesc}>{archetypeDef.description}</Text>
              </View>
            )}

            {/* 7 편향 강도 바 */}
            <View style={styles.biasGrid}>
              {BIAS_META.map((meta) => {
                const intensity = calcIntensity(meta, assessment.answers);
                const flagActive = assessment.bias_flags[meta.key];
                const color = intensityColor(intensity);
                return (
                  <View key={meta.key} style={styles.biasRow}>
                    <View style={styles.biasLabelWrap}>
                      <Text style={styles.biasLabel}>{meta.label}</Text>
                      {flagActive && (
                        <View style={[styles.flagDot, { backgroundColor: meta.color }]} />
                      )}
                    </View>
                    <View style={styles.biasBarTrack}>
                      <View
                        style={[
                          styles.biasBarFill,
                          { width: `${Math.round(intensity * 100)}%` as any, backgroundColor: color },
                        ]}
                      />
                    </View>
                    <Text style={[styles.biasIntensity, { color }]}>
                      {Math.round(intensity * 100)}%
                    </Text>
                  </View>
                );
              })}
            </View>

            <Text style={styles.cardFootnote}>
              ● 활성 편향 / 막대 = 강도 (0-100%)
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.card, styles.emptyCard]}
            onPress={() => {}}
          >
            <Text style={styles.emptyIcon}>🧠</Text>
            <Text style={styles.emptyTitle}>편향 진단이 필요합니다</Text>
            <Text style={styles.emptyDesc}>
              온보딩 진단을 완료하면{'\n'}편향 프로파일이 표시됩니다
            </Text>
          </TouchableOpacity>
        )}

        {/* ── 규율 트렌드 (14일) ────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>규율 트렌드 (14일)</Text>
            {avgScore !== null && (
              <Text style={[styles.cardMeta, { color: getDisciplineColor(avgScore), fontWeight: '700' }]}>
                평균 {avgScore}점
              </Text>
            )}
          </View>

          {disciplineLogs.length === 0 ? (
            <View style={styles.emptyInCard}>
              <Text style={styles.emptyInCardText}>아직 기록된 규율 점수가 없습니다</Text>
              <Text style={styles.emptyInCardSub}>일지를 작성하면 점수가 쌓입니다</Text>
            </View>
          ) : (
            <>
              {/* 미니 바 차트 */}
              <View style={styles.barChart}>
                {(() => {
                  // 14일 전체를 날짜 기준으로 채우기 (누락일 = 0점 회색)
                  const map: Record<string, number> = {};
                  disciplineLogs.forEach((l) => { map[l.log_date] = l.total_score; });
                  const today = new Date();
                  const bars: { date: string; score: number | null }[] = [];
                  for (let i = 13; i >= 0; i--) {
                    const d = new Date(today); d.setDate(today.getDate() - i);
                    const key = d.toISOString().split('T')[0];
                    bars.push({ date: key, score: map[key] ?? null });
                  }
                  return bars.map((b) => (
                    <View key={b.date} style={styles.barWrapper}>
                      <Text style={styles.barScore}>
                        {b.score !== null ? b.score : ''}
                      </Text>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            b.score !== null
                              ? { height: `${b.score}%` as any, backgroundColor: barColor(b.score) }
                              : { height: '4%', backgroundColor: Colors.border },
                          ]}
                        />
                      </View>
                      <Text style={styles.barDate}>{fmtDate(b.date)}</Text>
                    </View>
                  ));
                })()}
              </View>

              {/* 점수 범례 */}
              <View style={styles.legend}>
                {([
                  { color: Colors.disciplineTeal, label: '90-100' },
                  { color: Colors.disciplineGreen, label: '70-89' },
                  { color: Colors.disciplineGold, label: '40-69' },
                  { color: Colors.disciplineRed, label: '0-39' },
                ] as const).map((l) => (
                  <View key={l.label} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: l.color }]} />
                    <Text style={styles.legendText}>{l.label}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>

        {/* ── 30일 통계 ─────────────────────────────────── */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{journalCount30d}일</Text>
            <Text style={styles.statLabel}>일지 작성{'\n'}(30일)</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: avgScore ? getDisciplineColor(avgScore) : Colors.textFaint }]}>
              {avgScore ?? '–'}점
            </Text>
            <Text style={styles.statLabel}>평균 규율{'\n'}점수</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{disciplineLogs.length}일</Text>
            <Text style={styles.statLabel}>규율 측정{'\n'}(14일)</Text>
          </View>
        </View>

        {/* ── 최근 코칭 카드 ────────────────────────────── */}
        {coaching && (
          <View style={[styles.card, styles.coachingCard]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: Colors.primary }]}>최근 코칭</Text>
              <Text style={styles.cardMeta}>{fmtMonth(coaching.card_date)}</Text>
            </View>
            <Text style={styles.coachingText}>{coaching.content}</Text>
            {coaching.source === 'ai_generated' && (
              <View style={styles.aiSourceBadge}>
                <Text style={styles.aiSourceText}>AI 개인화 코칭</Text>
              </View>
            )}
          </View>
        )}

        {/* ── 재진단 안내 ───────────────────────────────── */}
        {assessment && (
          <View style={styles.retestNote}>
            <Text style={styles.retestText}>
              편향 재진단은 최소 3개월 후 권장됩니다.{'\n'}
              지속적인 일지 작성이 가장 효과적인 편향 교정법입니다.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const BAR_H = 80;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surfaceBg },
  scroll: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 140, gap: Spacing.md },

  title: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },

  // ── 공통 카드 ──────────────────────────────────────────
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    ...Shadow.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  cardMeta: { fontSize: 12, color: Colors.textMuted },
  cardFootnote: { fontSize: 11, color: Colors.textFaint, marginTop: 10 },

  // ── 아키타입 ───────────────────────────────────────────
  archetypeBadge: {
    borderRadius: Radius.sm,
    borderWidth: 1,
    padding: 10,
    marginBottom: 12,
  },
  archetypeLabel: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  archetypeDesc: { fontSize: 12, color: Colors.textMuted },

  // ── 편향 바 ────────────────────────────────────────────
  biasGrid: { gap: 6 },
  biasRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  biasLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 72,
    gap: 4,
  },
  biasLabel: { fontSize: 12, color: Colors.textSecondary, flex: 1 },
  flagDot: {
    width: 6,
    height: 6,
    borderRadius: Radius.full,
  },
  biasBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.surfaceOff,
    borderRadius: Radius.xs,
    overflow: 'hidden',
  },
  biasBarFill: {
    height: 8,
    borderRadius: Radius.xs,
  },
  biasIntensity: {
    fontSize: 11,
    fontWeight: '600',
    width: 32,
    textAlign: 'right',
  },

  // ── 빈 상태 ────────────────────────────────────────────
  emptyCard: { alignItems: 'center', paddingVertical: 32 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary, marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  emptyInCard: { paddingVertical: 20, alignItems: 'center' },
  emptyInCardText: { fontSize: 14, color: Colors.textSecondary, marginBottom: 4 },
  emptyInCardSub: { fontSize: 12, color: Colors.textMuted },

  // ── 규율 트렌드 바 차트 ─────────────────────────────────
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: BAR_H + 32,
    gap: 3,
    marginBottom: 8,
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
    height: BAR_H + 32,
    justifyContent: 'flex-end',
  },
  barScore: {
    fontSize: 7,
    color: Colors.textFaint,
    marginBottom: 1,
    lineHeight: 10,
    textAlign: 'center',
  },
  barTrack: {
    width: '100%',
    height: BAR_H,
    backgroundColor: Colors.surfaceOff,
    borderRadius: Radius.xs,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: Radius.xs,
  },
  barDate: {
    fontSize: 7,
    color: Colors.textFaint,
    marginTop: 2,
    textAlign: 'center',
  },

  // ── 범례 ───────────────────────────────────────────────
  legend: { flexDirection: 'row', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: Radius.full },
  legendText: { fontSize: 10, color: Colors.textMuted },

  // ── 통계 카드 ──────────────────────────────────────────
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    alignItems: 'center',
    ...Shadow.card,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },

  // ── 코칭 카드 ──────────────────────────────────────────
  coachingCard: { borderLeftWidth: 3, borderLeftColor: Colors.primary },
  coachingText: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  aiSourceBadge: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  aiSourceText: { fontSize: 11, color: Colors.primary, fontWeight: '600' },

  // ── 재진단 안내 ────────────────────────────────────────
  retestNote: {
    backgroundColor: Colors.surfaceOff,
    borderRadius: Radius.sm,
    padding: 14,
  },
  retestText: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 20,
    textAlign: 'center',
  },
});
