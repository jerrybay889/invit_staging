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

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Modal,
} from 'react-native';
import { Analytics } from '../lib/analytics';
import { showAlert } from '../lib/platformAlert';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Colors } from '../constants/colors';
import { Radius, Shadow } from '../constants/theme';
import StockSearchInput from '../components/StockSearchInput';
import { TRADE_REASON_OPTIONS, PRINCIPLE_COMPLIANCE_OPTIONS } from '../constants/journal';
import type {
  Principle,
  TradeAction,
  InvestmentJournal,
  TradeReasonTag,
  PrincipleCompliance,
  Stock,
} from '../types/database';
import type { MainStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<MainStackParamList>;
type RouteParams = RouteProp<MainStackParamList, 'JournalCreate'>;

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
  const route = useRoute<RouteParams>();
  const { user } = useAuth();
  const editDate = route.params?.date;

  // Form state
  const [emotionCheckin, setEmotionCheckin] = useState<number | null>(null);
  const [tradeAction, setTradeAction] = useState<TradeAction>('none');
  const [ticker, setTicker] = useState('');
  const [tradeRationale, setTradeRationale] = useState('');
  const [biasCheck, setBiasCheck] = useState<boolean | null>(null);
  const [emotionMemo, setEmotionMemo] = useState('');
  const [principleChecks, setPrincipleChecks] = useState<Record<string, boolean>>({});
  const [principles, setPrinciples] = useState<Principle[]>([]);
  // ── 마스터플랜 0617 Pillar 1 신규 입력 ──
  const [tradeReasonTags, setTradeReasonTags] = useState<TradeReasonTag[]>([]);
  const [principleCompliance, setPrincipleCompliance] = useState<PrincipleCompliance | null>(null);
  const [impulseBuy, setImpulseBuy] = useState('');   // 사고 싶었지만 참은 종목코드
  const [impulseSell, setImpulseSell] = useState(''); // 팔고 싶었지만 참은 종목코드

  // UI state
  const [saving, setSaving] = useState(false);
  const [emotionError, setEmotionError] = useState(false);
  // G3: 즉시 코칭 피드백 모달
  const [coachingModal, setCoachingModal] = useState(false);
  const [coachingMessage, setCoachingMessage] = useState('');
  const [disciplineScore, setDisciplineScore] = useState<number | null>(null);

  // 일지 작성 소요 시간 측정 (entry_duration_seconds — B2B 분석 지표)
  const entryStartRef = useRef<number>(Date.now());

  const toggleReasonTag = (tag: TradeReasonTag) => {
    setTradeReasonTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

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

  const fetchExistingJournal = useCallback(async () => {
    if (!user || !editDate) return;
    const { data } = await supabase
      .from('investment_journals')
      .select('*')
      .eq('user_id', user.id)
      .eq('journal_date', editDate)
      .single();
    if (data) {
      const j = data as InvestmentJournal;
      setEmotionCheckin(j.emotion_checkin);
      setTradeAction(j.trade_action);
      setTicker(j.ticker ?? '');
      setTradeRationale(j.trade_rationale ?? '');
      setBiasCheck(j.bias_check ?? null);
      setEmotionMemo(j.emotion_memo ?? '');
      setPrincipleChecks(j.principle_checks ?? {});
      setTradeReasonTags((j.trade_reason_tags as TradeReasonTag[]) ?? []);
      setPrincipleCompliance(j.principle_compliance ?? null);
      setImpulseBuy(j.impulse_buy_ticker ?? '');
      setImpulseSell(j.impulse_sell_ticker ?? '');
    }
  }, [user, editDate]);

  useEffect(() => {
    fetchPrinciples();
    fetchExistingJournal();
  }, [fetchPrinciples, fetchExistingJournal]);

  const handleSave = async () => {
    // 로컬 validation — emotion_checkin 필수 (EF 409 사전 차단)
    if (emotionCheckin === null) {
      setEmotionError(true);
      return;
    }
    if (!user) return;

    setSaving(true);
    const today = new Date().toISOString().split('T')[0];
    const entryDuration = Math.max(
      0,
      Math.round((Date.now() - entryStartRef.current) / 1000),
    );

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
            // ── Pillar 1 확장 컬럼 (마이그레이션 011) ──
            has_trade: tradeAction !== 'none',
            impulse_buy_ticker: tradeAction === 'none' ? impulseBuy.trim() || null : null,
            impulse_sell_ticker: tradeAction === 'none' ? impulseSell.trim() || null : null,
            trade_reason_tags: tradeAction !== 'none' ? tradeReasonTags : [],
            principle_compliance: tradeAction !== 'none' ? principleCompliance : null,
            entry_duration_seconds: entryDuration,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,journal_date' },
        );

      if (journalError) throw journalError;

      // G4: 일지 저장 이벤트 계측
      Analytics.track('journal_saved', { trade_action: tradeAction, has_rationale: !!tradeRationale.trim() });

      // Step 2: calculate-discipline EF 호출
      const { data: disciplineData, error: disciplineError } = await supabase.functions.invoke(
        'calculate-discipline',
        { body: { emotion_checkin: emotionCheckin, date: today } },
      );
      if (disciplineError) {
        console.error('calculate-discipline failed:', disciplineError);
      }
      const dScore: number | null =
        (disciplineData as any)?.discipline?.total_score ?? null;

      // Step 3: generate-coaching — await with 8s timeout (G3)
      const coachingPromise = supabase.functions.invoke('generate-coaching', { body: {} });
      const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: new Error('timeout') }), 8000),
      );
      const { data: coachingData } = await Promise.race([coachingPromise, timeoutPromise]);
      const msg: string =
        (coachingData as any)?.coaching?.message ??
        '오늘의 원칙을 다시 확인해보세요. 일지를 작성하면 내일 새로운 코칭이 준비됩니다.';

      // Step 4: 코칭 결과 모달 표시 (G3) — goBack은 모달 닫기 시
      setDisciplineScore(dScore);
      setCoachingMessage(msg);
      setCoachingModal(true);

      // G4: 코칭 모달 표시 이벤트
      Analytics.track('coaching_viewed', { source: (coachingData as any)?.coaching?.source ?? 'template' });
    } catch (error) {
      showAlert('저장 실패', '일지를 저장하지 못했습니다. 다시 시도해주세요.');
      console.error('Journal save failed:', error);
    } finally {
      setSaving(false);
    }
  };

  const today = new Date();
  const dateStr = today.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >

        {/* 날짜 헤더 */}
        <View style={styles.dateHeader}>
          <Text style={styles.dateText}>{dateStr}</Text>
        </View>

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

          {/* 매수/매도 선택 시: 종목 검색 + 매매 이유 + 원칙 준수 */}
          {tradeAction !== 'none' && (
            <View style={{ marginTop: 8 }}>
              <Text style={styles.subLabel}>종목</Text>
              <StockSearchInput
                value={ticker}
                onSelect={(s: Stock | null) => setTicker(s ? s.code : '')}
              />

              <Text style={[styles.subLabel, { marginTop: 16 }]}>
                매매 이유 <Text style={styles.optional}>(복수 선택)</Text>
              </Text>
              <View style={styles.chipWrap}>
                {TRADE_REASON_OPTIONS.map((opt) => {
                  const on = tradeReasonTags.includes(opt.value);
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.chip, on && styles.chipSelected]}
                      onPress={() => toggleReasonTag(opt.value)}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextSelected]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.subLabel, { marginTop: 16 }]}>
                이번 매매, 원칙을 지켰나요? <Text style={styles.optional}>(선택)</Text>
              </Text>
              <View style={styles.tradeRow}>
                {PRINCIPLE_COMPLIANCE_OPTIONS.map((opt) => {
                  const on = principleCompliance === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.tradeBtn, on && styles.tradeBtnSelected]}
                      onPress={() =>
                        setPrincipleCompliance((prev) => (prev === opt.value ? null : opt.value))
                      }
                    >
                      <Text style={[styles.tradeBtnText, on && styles.tradeBtnTextSelected]}>
                        {opt.symbol} {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        {/* 무거래일: 오늘의 충동 신호 (마스터플랜 Pillar 1) */}
        {tradeAction === 'none' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              오늘의 충동 신호 <Text style={styles.optional}>(선택)</Text>
            </Text>
            <Text style={styles.helpText}>사고 싶었지만 참은 종목이 있나요?</Text>
            <StockSearchInput
              value={impulseBuy}
              onSelect={(s: Stock | null) => setImpulseBuy(s ? s.code : '')}
              placeholder="사고 싶었던 종목 검색"
            />
            <Text style={[styles.helpText, { marginTop: 14 }]}>
              팔고 싶었지만 참은 종목이 있나요?
            </Text>
            <StockSearchInput
              value={impulseSell}
              onSelect={(s: Stock | null) => setImpulseSell(s ? s.code : '')}
              placeholder="팔고 싶었던 종목 검색"
            />
          </View>
        )}

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

      {/* G3: 즉시 코칭 피드백 모달 */}
      <Modal
        visible={coachingModal}
        transparent
        animationType="fade"
        onRequestClose={() => { setCoachingModal(false); navigation.goBack(); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>일지 저장 완료</Text>

            {disciplineScore !== null && (
              <View style={styles.scoreBox}>
                <Text style={styles.scoreLabel}>오늘의 규율 점수</Text>
                <Text style={styles.scoreValue}>{disciplineScore}<Text style={styles.scoreUnit}>/100</Text></Text>
              </View>
            )}

            <View style={styles.coachingBox}>
              <Text style={styles.coachingLabel}>오늘의 코칭</Text>
              <Text style={styles.coachingText}>{coachingMessage}</Text>
            </View>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => { setCoachingModal(false); navigation.goBack(); }}
            >
              <Text style={styles.modalCloseBtnText}>확인</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surfaceBg,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },
  dateHeader: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dateText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 12,
    ...Shadow.card,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  required: {
    color: Colors.error,
  },
  optional: {
    fontWeight: '400',
    color: Colors.textMuted,
    fontSize: 12,
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
    borderRadius: Radius.sm,
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
    gap: 6,
  },
  emotionBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface2,
  },
  emotionBtnSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
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
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface2,
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
  subLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // 매매 이유 칩
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface2,
  },
  chipSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  chipText: {
    fontSize: 13,
    color: Colors.textPrimary,
  },
  chipTextSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
  // Bias check
  checkRow: {
    flexDirection: 'row',
    gap: 8,
  },
  checkBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface2,
    alignItems: 'center',
  },
  checkBtnSelected: {
    borderColor: Colors.success,
    backgroundColor: Colors.success + '12',
  },
  checkBtnWarning: {
    borderColor: Colors.warning,
    backgroundColor: Colors.warning + '12',
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
    borderRadius: Radius.xs,
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
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
    ...Shadow.elevated,
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
  // G3: 코칭 피드백 모달
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: 24,
    width: '100%',
    gap: 16,
    ...Shadow.modal,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  scoreBox: {
    backgroundColor: Colors.primary + '12',
    borderRadius: Radius.sm,
    padding: 16,
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  scoreValue: {
    fontSize: 40,
    fontWeight: '700',
    color: Colors.primary,
  },
  scoreUnit: {
    fontSize: 18,
    fontWeight: '400',
    color: Colors.textMuted,
  },
  coachingBox: {
    backgroundColor: Colors.surfaceBg,
    borderRadius: Radius.sm,
    padding: 14,
    gap: 6,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  coachingLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  coachingText: {
    fontSize: 14,
    lineHeight: 22,
    color: Colors.textPrimary,
  },
  modalCloseBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  modalCloseBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
});

