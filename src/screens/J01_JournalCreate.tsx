/**
 * J01_JournalCreate — 투자 일지 작성 화면
 *
 * 저장 플로우 (순서 엄수):
 *   Step 1: investment_journals UPSERT
 *   Step 2: calculate-discipline EF 호출 (EF가 DB 직접 조회하므로 일지 먼저 INSERT)
 *   Step 3: generate-coaching EF 호출
 *   Step 4: navigate('Home')
 *
 * Lock 1: AI 호출은 EF 경유만 (클라이언트 직접 호출 금지)
 * Lock 3: discipline_logs/coaching_cards는 EF가 INSERT — 클라이언트 SELECT 전용
 * Lock 4: UPSERT onConflict 'user_id,journal_date'
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Colors } from '../constants/colors';
import type { Principle, TradeAction } from '../types/database';
import type { MainStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;

const EMOTION_OPTIONS = [
  { value: 1, label: '매우 불안', emoji: '😰' },
  { value: 2, label: '불안', emoji: '😟' },
  { value: 3, label: '평온', emoji: '😐' },
  { value: 4, label: '자신감', emoji: '😊' },
  { value: 5, label: '매우 자신감', emoji: '😄' },
];

const TRADE_OPTIONS: { value: TradeAction; label: string }[] = [
  { value: 'none', label: '매매 없음' },
  { value: 'buy', label: '매수' },
  { value: 'sell', label: '매도' },
];

export default function J01_JournalCreate() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();

  // Form state
  const [emotionCheckin, setEmotionCheckin] = useState<number | null>(null);
  const [tradeAction, setTradeAction] = useState<TradeAction>('none');
  const [ticker, setTicker] = useState('');
  const [tradeRationale, setTradeRationale] = useState('');
  const [biasCheck, setBiasCheck] = useState<boolean | null>(null);
  const [emotionMemo, setEmotionMemo] = useState('');
  const [principleChecks, setPrincipleChecks] = useState<Record<string, boolean>>({});
  const [principles, setPrinciples] = useState<Principle[]>([]);

  // UI state
  const [saving, setSaving] = useState(false);
  const [emotionError, setEmotionError] = useState(false);

  const fetchPrinciples = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('principles')
      .select('id, content, is_active, sort_order')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    setPrinciples((data as Principle[]) ?? []);
    // 기본값: 모든 원칙 false
    const initial: Record<string, boolean> = {};
    (data ?? []).forEach((p) => { initial[(p as Principle).id] = false; });
    setPrincipleChecks(initial);
  }, [user]);

  useEffect(() => {
    fetchPrinciples();
  }, [fetchPrinciples]);

  const handleSave = async () => {
    // 로컬 validation — emotion_checkin 필수 (EF 409 사전 차단)
    if (emotionCheckin === null) {
      setEmotionError(true);
      return;
    }
    if (!user) return;

    setSaving(true);
    const today = new Date().toISOString().split('T')[0];

    try {
      // Step 1: investment_journals UPSERT (Lock 4 — onConflict)
      const { error: journalError } = await supabase
        .from('investment_journals')
        .upsert(
          {
            user_id: user.id,
            journal_date: today,
            emotion_checkin: emotionCheckin,
            trade_action: tradeAction,
            ticker: tradeAction !== 'none' ? ticker.trim() || null : null,
            trade_rationale: tradeRationale.trim() || null,
            bias_check: biasCheck,
            emotion_memo: emotionMemo.trim() || null,
            principle_checks: principleChecks,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,journal_date' },
        );

      if (journalError) throw journalError;

      // Step 2: calculate-discipline EF 호출
      // 일지 INSERT 완료 후 호출 (EF가 investment_journals를 직접 조회)
      const { error: disciplineError } = await supabase.functions.invoke('calculate-discipline', {
        body: { emotion_checkin: emotionCheckin, date: today },
      });

      if (disciplineError) {
        console.error('calculate-discipline failed:', disciplineError);
        // 비치명적 — 일지는 저장됨
      }

      // Step 3: generate-coaching EF 호출
      const { error: coachingError } = await supabase.functions.invoke('generate-coaching', {
        body: {},
      });

      if (coachingError) {
        console.error('generate-coaching failed:', coachingError);
        // 비치명적 — 코칭 없어도 홈 이동
      }

      // Step 4: 홈으로 이동 (discipline_score 갱신 트리거)
      navigation.navigate('Home');
    } catch (error) {
      Alert.alert('저장 실패', '일지를 저장하지 못했습니다. 다시 시도해주세요.');
      console.error('Journal save failed:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* 감정 체크인 (필수) */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            오늘의 감정 <Text style={styles.required}>*</Text>
          </Text>
          {emotionError && (
            <Text style={styles.errorText}>감정을 선택해주세요</Text>
          )}
          <View style={styles.emotionRow}>
            {EMOTION_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.emotionBtn,
                  emotionCheckin === opt.value && styles.emotionBtnSelected,
                ]}
                onPress={() => {
                  setEmotionCheckin(opt.value);
                  setEmotionError(false);
                }}
              >
                <Text style={styles.emotionEmoji}>{opt.emoji}</Text>
                <Text style={[
                  styles.emotionLabel,
                  emotionCheckin === opt.value && styles.emotionLabelSelected,
                ]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 매매 행동 (필수) */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>오늘 매매했나요?</Text>
          <View style={styles.tradeRow}>
            {TRADE_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.tradeBtn,
                  tradeAction === opt.value && styles.tradeBtnSelected,
                ]}
                onPress={() => setTradeAction(opt.value)}
              >
                <Text style={[
                  styles.tradeBtnText,
                  tradeAction === opt.value && styles.tradeBtnTextSelected,
                ]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 매수/매도 선택 시 종목 입력 */}
          {tradeAction !== 'none' && (
            <View style={styles.tickerRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={ticker}
                onChangeText={setTicker}
                placeholder="종목 코드 (예: 005930)"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="characters"
                maxLength={10}
              />
            </View>
          )}
        </View>

        {/* 매매 근거 */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>매매 근거 <Text style={styles.optional}>(선택)</Text></Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={tradeRationale}
            onChangeText={setTradeRationale}
            placeholder="오늘 투자 결정의 이유를 기록하세요"
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* 편향 점검 */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>편향 점검 <Text style={styles.optional}>(선택)</Text></Text>
          <Text style={styles.helpText}>오늘 투자 결정에 감정적 편향이 없었나요?</Text>
          <View style={styles.checkRow}>
            <TouchableOpacity
              style={[styles.checkBtn, biasCheck === true && styles.checkBtnSelected]}
              onPress={() => setBiasCheck(prev => prev === true ? null : true)}
            >
              <Text style={[styles.checkBtnText, biasCheck === true && styles.checkBtnTextSelected]}>
                편향 없음
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.checkBtn, biasCheck === false && styles.checkBtnWarning]}
              onPress={() => setBiasCheck(prev => prev === false ? null : false)}
            >
              <Text style={[styles.checkBtnText, biasCheck === false && styles.checkBtnTextSelected]}>
                편향 있었음
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 원칙 체크 */}
        {principles.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>원칙 준수 <Text style={styles.optional}>(선택)</Text></Text>
            {principles.map(p => (
              <TouchableOpacity
                key={p.id}
                style={styles.principleRow}
                onPress={() => setPrincipleChecks(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
              >
                <View style={[styles.checkbox, principleChecks[p.id] && styles.checkboxChecked]}>
                  {principleChecks[p.id] && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.principleText}>{p.content}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* 감정 메모 */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>감정 메모 <Text style={styles.optional}>(선택)</Text></Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={emotionMemo}
            onChangeText={setEmotionMemo}
            placeholder="오늘 시장을 보며 느낀 감정을 자유롭게 기록하세요"
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* 저장 버튼 */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <View style={styles.savingRow}>
              <ActivityIndicator size="small" color={Colors.white} />
              <Text style={styles.saveBtnText}>저장 중...</Text>
            </View>
          ) : (
            <Text style={styles.saveBtnText}>일지 저장</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </KeyboardAvoidingView>
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
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  required: {
    color: Colors.error,
  },
  optional: {
    fontWeight: '400',
    color: Colors.textMuted,
    fontSize: 13,
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
    marginBottom: 6,
  },
  helpText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.textPrimary,
    backgroundColor: Colors.inputBg,
  },
  textArea: {
    height: 88,
    paddingTop: 10,
  },
  // Emotion
  emotionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  emotionBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  emotionBtnSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#E6F2F3',
  },
  emotionEmoji: {
    fontSize: 22,
    marginBottom: 2,
  },
  emotionLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  emotionLabelSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
  // Trade
  tradeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  tradeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    alignItems: 'center',
  },
  tradeBtnSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  tradeBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  tradeBtnTextSelected: {
    color: Colors.white,
  },
  tickerRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  // Bias check
  checkRow: {
    flexDirection: 'row',
    gap: 8,
  },
  checkBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    alignItems: 'center',
  },
  checkBtnSelected: {
    borderColor: Colors.success,
    backgroundColor: '#EBF5E6',
  },
  checkBtnWarning: {
    borderColor: Colors.warning,
    backgroundColor: '#FEF3E2',
  },
  checkBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  checkBtnTextSelected: {
    fontWeight: '600',
  },
  // Principle checks
  principleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkmark: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  principleText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  // Save
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  savingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
