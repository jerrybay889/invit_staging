/**
 * J02_JournalView — 투자 일지 조회 화면
 * Lock 3: investment_journals, discipline_logs SELECT 전용
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Colors } from '../constants/colors';
import { getDisciplineColor, getDisciplineMessage } from '../constants/discipline';
import type { InvestmentJournal, DisciplineLog, Principle } from '../types/database';
import type { MainStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;
type RouteParams = RouteProp<MainStackParamList, 'JournalView'>;

const EMOTION_MAP: Record<number, { label: string; emoji: string }> = {
  1: { label: '매우 불안', emoji: '😰' },
  2: { label: '불안', emoji: '😟' },
  3: { label: '평온', emoji: '😐' },
  4: { label: '자신감', emoji: '😊' },
  5: { label: '매우 자신감', emoji: '😄' },
};

const TRADE_ACTION_LABEL: Record<string, string> = {
  buy: '매수',
  sell: '매도',
  none: '매매 없음',
};

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <View style={styles.scoreRow}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <View style={styles.scoreBarBg}>
        <View style={[styles.scoreBarFill, { width: `${score}%` as any }]} />
      </View>
      <Text style={styles.scoreValue}>{score}점</Text>
    </View>
  );
}

export default function J02_JournalView() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteParams>();
  const { user } = useAuth();

  const today = new Date().toISOString().split('T')[0];
  const date = route.params?.date ?? today;

  const [journal, setJournal] = useState<InvestmentJournal | null>(null);
  const [disciplineLog, setDisciplineLog] = useState<DisciplineLog | null>(null);
  const [principles, setPrinciples] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetch = async () => {
      const [journalRes, logRes, principlesRes] = await Promise.all([
        supabase
          .from('investment_journals')
          .select('*')
          .eq('user_id', user.id)
          .eq('journal_date', date)
          .single(),
        supabase
          .from('discipline_logs')
          .select('*')
          .eq('user_id', user.id)
          .eq('log_date', date)
          .single(),
        supabase
          .from('principles')
          .select('id, content')
          .eq('user_id', user.id),
      ]);

      setJournal(journalRes.data as InvestmentJournal | null);
      setDisciplineLog(logRes.data as DisciplineLog | null);

      const principleMap: Record<string, string> = {};
      (principlesRes.data ?? []).forEach((p) => {
        principleMap[(p as Principle).id] = (p as Principle).content;
      });
      setPrinciples(principleMap);
      setLoading(false);
    };

    fetch();
  }, [user, date]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (!journal) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>{date} 일지 없음</Text>
        <Text style={styles.emptyText}>이 날짜의 일지가 없습니다.</Text>
        <TouchableOpacity style={styles.writeBtn} onPress={() => navigation.navigate('JournalCreate')}>
          <Text style={styles.writeBtnText}>일지 작성하기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const emotion = EMOTION_MAP[journal.emotion_checkin] ?? { label: '알 수 없음', emoji: '❓' };
  const principleChecks = journal.principle_checks ?? {};
  const checkedPrinciples = Object.entries(principleChecks).filter(([, v]) => v);
  const uncheckedPrinciples = Object.entries(principleChecks).filter(([, v]) => !v);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {/* 날짜 헤더 */}
      <Text style={styles.dateHeader}>{date}</Text>

      {/* 감정 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>감정 체크인</Text>
        <View style={styles.emotionDisplay}>
          <Text style={styles.emotionEmoji}>{emotion.emoji}</Text>
          <Text style={styles.emotionLabel}>{emotion.label} ({journal.emotion_checkin}/5)</Text>
        </View>
        {journal.emotion_memo ? (
          <Text style={styles.memoText}>{journal.emotion_memo}</Text>
        ) : null}
      </View>

      {/* 매매 행동 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>매매 행동</Text>
        <Text style={styles.tradeAction}>{TRADE_ACTION_LABEL[journal.trade_action]}</Text>
        {journal.ticker ? (
          <Text style={styles.infoText}>종목: {journal.ticker}</Text>
        ) : null}
        {journal.trade_rationale ? (
          <View style={styles.rationaleBox}>
            <Text style={styles.rationaleLabel}>매매 근거</Text>
            <Text style={styles.rationaleText}>{journal.trade_rationale}</Text>
          </View>
        ) : null}
      </View>

      {/* 편향 점검 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>편향 점검</Text>
        {journal.bias_check === null ? (
          <Text style={styles.infoText}>기록 없음 (자동: 편향 없음으로 처리)</Text>
        ) : journal.bias_check ? (
          <Text style={[styles.infoText, { color: Colors.success }]}>편향 없음</Text>
        ) : (
          <Text style={[styles.infoText, { color: Colors.warning }]}>편향 있었음</Text>
        )}
      </View>

      {/* 원칙 체크 */}
      {Object.keys(principleChecks).length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>원칙 준수</Text>
          {checkedPrinciples.map(([id]) => (
            <View key={id} style={styles.principleRow}>
              <Text style={[styles.checkMark, { color: Colors.success }]}>✓</Text>
              <Text style={styles.principleText}>{principles[id] ?? id}</Text>
            </View>
          ))}
          {uncheckedPrinciples.map(([id]) => (
            <View key={id} style={styles.principleRow}>
              <Text style={[styles.checkMark, { color: Colors.textMuted }]}>○</Text>
              <Text style={[styles.principleText, { color: Colors.textMuted }]}>
                {principles[id] ?? id}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* 규율 점수 */}
      {disciplineLog ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>규율 점수</Text>
          <View style={styles.totalScoreRow}>
            <Text style={[styles.totalScore, { color: getDisciplineColor(disciplineLog.total_score) }]}>
              {disciplineLog.total_score}점
            </Text>
            <Text style={styles.totalScoreMsg}>
              {getDisciplineMessage(disciplineLog.total_score)}
            </Text>
          </View>
          <View style={styles.scoreBars}>
            <ScoreBar label="일지 (40%)" score={disciplineLog.journal_score} />
            <ScoreBar label="원칙 (40%)" score={disciplineLog.principle_score} />
            <ScoreBar label="감정 (20%)" score={disciplineLog.emotion_score} />
          </View>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>규율 점수</Text>
          <Text style={styles.infoText}>아직 점수가 계산되지 않았습니다.</Text>
        </View>
      )}

      {/* 수정 버튼 */}
      <TouchableOpacity
        style={styles.editBtn}
        onPress={() => navigation.navigate('JournalCreate')}
      >
        <Text style={styles.editBtnText}>일지 수정</Text>
      </TouchableOpacity>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surfaceBg,
  },
  scroll: {
    padding: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surfaceBg,
    padding: 24,
  },
  dateHeader: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  // Emotion
  emotionDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emotionEmoji: {
    fontSize: 28,
  },
  emotionLabel: {
    fontSize: 16,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  memoText: {
    marginTop: 8,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  // Trade
  tradeAction: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  rationaleBox: {
    marginTop: 10,
    backgroundColor: Colors.surfaceBg,
    borderRadius: 8,
    padding: 10,
  },
  rationaleLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 4,
  },
  rationaleText: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  // Principle
  principleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 4,
  },
  checkMark: {
    fontSize: 16,
    fontWeight: '700',
    width: 20,
    textAlign: 'center',
  },
  principleText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  // Discipline Score
  totalScoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    marginBottom: 12,
  },
  totalScore: {
    fontSize: 32,
    fontWeight: '800',
  },
  totalScoreMsg: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  scoreBars: {
    gap: 8,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreLabel: {
    width: 72,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  scoreBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  scoreValue: {
    width: 36,
    fontSize: 12,
    color: Colors.textPrimary,
    fontWeight: '600',
    textAlign: 'right',
  },
  // Empty / buttons
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 24,
  },
  writeBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  writeBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  editBtn: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  editBtnText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
});
