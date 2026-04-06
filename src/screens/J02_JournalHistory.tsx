/**
 * J02_JournalHistory — 일지 히스토리 탭 화면 (TASK C: 날짜별 리스트)
 * 현재: 기본 플레이스홀더 (TASK C에서 확장)
 * Lock 3: investment_journals SELECT only
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/colors';
import type { InvestmentJournal } from '../types/database';
import type { MainStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

const EMOTION_EMOJI: Record<number, string> = {
  1: '😰', 2: '😟', 3: '😐', 4: '😊', 5: '😄',
};

const TRADE_LABEL: Record<string, string> = {
  none: '매매 없음', buy: '매수', sell: '매도',
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
}

export default function J02_JournalHistory() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const [journals, setJournals] = useState<InvestmentJournal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJournals = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('investment_journals')
      .select('id, journal_date, emotion_checkin, trade_action, trade_rationale')
      .eq('user_id', user.id)
      .order('journal_date', { ascending: false })
      .limit(50);
    setJournals((data as InvestmentJournal[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchJournals();
  }, [fetchJournals]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: 60 }} color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>일지 기록</Text>
        <TouchableOpacity
          style={styles.writeBtn}
          onPress={() => navigation.navigate('JournalCreate')}
        >
          <Text style={styles.writeBtnText}>+ 오늘 일지</Text>
        </TouchableOpacity>
      </View>

      {journals.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📓</Text>
          <Text style={styles.emptyTitle}>아직 작성한 일지가 없습니다</Text>
          <Text style={styles.emptyDesc}>매일 일지를 작성하면 규율 점수가 올라갑니다</Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => navigation.navigate('JournalCreate')}
          >
            <Text style={styles.emptyBtnText}>첫 일지 작성하기</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={journals}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('JournalView', { date: item.journal_date })}
            >
              <View style={styles.cardLeft}>
                <Text style={styles.cardEmoji}>
                  {EMOTION_EMOJI[item.emotion_checkin ?? 3] ?? '😐'}
                </Text>
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardDate}>{formatDate(item.journal_date)}</Text>
                <Text style={styles.cardMeta}>
                  {TRADE_LABEL[item.trade_action ?? 'none']}
                  {item.trade_rationale ? '  · 근거 있음' : ''}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surfaceBg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
  },
  title: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary },
  writeBtn: {
    backgroundColor: Colors.primary, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  writeBtnText: { fontSize: 14, fontWeight: '600', color: Colors.white },
  list: { paddingHorizontal: 20, paddingBottom: 24 },
  card: {
    backgroundColor: Colors.white, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8,
  },
  cardLeft: { marginRight: 12 },
  cardEmoji: { fontSize: 28 },
  cardContent: { flex: 1 },
  cardDate: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  cardMeta: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  chevron: { fontSize: 20, color: Colors.textMuted },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: Colors.textPrimary, marginBottom: 8, textAlign: 'center' },
  emptyDesc: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyBtn: {
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingHorizontal: 28, paddingVertical: 14,
  },
  emptyBtnText: { fontSize: 15, fontWeight: '600', color: Colors.white },
});
