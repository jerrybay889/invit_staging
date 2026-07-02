/**
 * S02 — Sign Up Screen
 * Supabase Auth email/password 회원가입
 * G2: PIPA 필수 동의 (이용약관 + 개인정보처리방침) — 미동의 시 가입 불가
 * Lock 6: 회원가입 시 면책 문구 표시
 * Lock 7: 동의 메타데이터만 저장, 본문은 외부 URL 호스팅
 */

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { Colors } from '../constants/colors';
import { Radius, Shadow } from '../constants/theme';

// ─── 약관 URL (Jerry: 정식 도메인 확정 후 교체) ───
const TERMS_URL = 'https://invit.app/terms';
const PRIVACY_URL = 'https://invit.app/privacy';
const PRIVACY_VERSION = '1.0';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function S02_SignUp({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [tosAgreed, setTosAgreed] = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [marketingAgreed, setMarketingAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  const canSubmit = tosAgreed && privacyAgreed && !loading;

  const handleSignUp = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('입력 오류', '이메일과 비밀번호를 입력해주세요.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('입력 오류', '비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('입력 오류', '비밀번호가 일치하지 않습니다.');
      return;
    }
    if (!tosAgreed || !privacyAgreed) {
      Alert.alert('동의 필요', '이용약관과 개인정보처리방침에 동의해주세요.');
      return;
    }

    setLoading(true);
    const consentAt = new Date().toISOString();

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: 'invit://auth/callback' },
    });

    if (error) {
      setLoading(false);
      Alert.alert('회원가입 실패', error.message);
      return;
    }

    // G2: 동의 메타데이터 저장 (Lock 7 — 본문 아닌 메타만)
    if (data?.user?.id) {
      supabase.from('users').upsert(
        {
          id: data.user.id,
          consent: {
            tos_at: consentAt,
            privacy_at: consentAt,
            privacy_version: PRIVACY_VERSION,
            marketing: marketingAgreed,
          },
          status: 'active',
        },
        { onConflict: 'id' },
      ).then(undefined, (e) => console.warn('[S02] consent upsert failed (non-fatal):', e));
    }

    setLoading(false);
    Alert.alert('확인', '인증 이메일을 발송했습니다. 이메일을 확인해주세요.', [
      { text: '확인', onPress: () => navigation.navigate('SignIn') },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>회원가입</Text>
          <Text style={styles.subtitle}>투자 습관 개선을 시작합니다</Text>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>이메일</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="name@example.com"
                placeholderTextColor={Colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>비밀번호</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="6자 이상"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>비밀번호 확인</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="비밀번호를 다시 입력"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry
              />
            </View>

            {/* G2 — 동의 항목 (PIPA 필수) */}
            <View style={styles.consentBox}>
              <Text style={styles.consentTitle}>약관 동의</Text>

              {/* 이용약관 [필수] */}
              <TouchableOpacity
                style={styles.consentRow}
                onPress={() => setTosAgreed((v) => !v)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, tosAgreed && styles.checkboxChecked]}>
                  {tosAgreed && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.consentLabel}>
                  <Text style={styles.required}>[필수] </Text>
                  <Text
                    style={styles.consentLink}
                    onPress={() => Linking.openURL(TERMS_URL)}
                  >
                    이용약관
                  </Text>
                  에 동의합니다
                </Text>
              </TouchableOpacity>

              {/* 개인정보처리방침 [필수] */}
              <TouchableOpacity
                style={styles.consentRow}
                onPress={() => setPrivacyAgreed((v) => !v)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, privacyAgreed && styles.checkboxChecked]}>
                  {privacyAgreed && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.consentLabel}>
                  <Text style={styles.required}>[필수] </Text>
                  <Text
                    style={styles.consentLink}
                    onPress={() => Linking.openURL(PRIVACY_URL)}
                  >
                    개인정보처리방침
                  </Text>
                  에 동의합니다
                </Text>
              </TouchableOpacity>

              {/* 마케팅 알림 [선택] */}
              <TouchableOpacity
                style={styles.consentRow}
                onPress={() => setMarketingAgreed((v) => !v)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, marketingAgreed && styles.checkboxChecked]}>
                  {marketingAgreed && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.consentLabel}>
                  <Text style={styles.optional}>[선택] </Text>
                  마케팅·서비스 알림 수신에 동의합니다
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, !canSubmit && styles.disabledButton]}
              onPress={handleSignUp}
              disabled={!canSubmit}
            >
              {loading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>가입하기</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate('SignIn')}
          >
            <Text style={styles.linkText}>이미 계정이 있으신가요? 로그인</Text>
          </TouchableOpacity>

          {/* Lock 6 — 면책 문구 (삭제·축약·위치 변경 금지) */}
          <View style={styles.disclaimerBox}>
            <Text style={styles.disclaimerText}>
              [중요 고지사항] 본 진단 결과는 귀하의 투자 행동 패턴에 대한 자기 인식을 돕기 위한
              교육적 도구로서, 특정 금융투자상품에 대한 투자 권유, 매수·매도 추천, 또는 투자
              적합성 판단을 목적으로 하지 않습니다. 본 서비스는 「자본시장과 금융투자업에 관한
              법률」에 따른 투자자문업에 해당하지 않으며, 해당 법률에 따른 등록 투자자문업자의
              서비스를 대체하지 않습니다. 진단 결과는 귀하의 행동 경향성을 참고하는 용도로만
              사용하시기 바라며, 실제 투자 결정은 귀하 본인의 판단과 책임 하에 이루어져야 합니다.
              투자에는 원금 손실의 위험이 있습니다. 본 진단 결과에 기반한 투자 손실에 대하여
              (주)글로보더는 법적 책임을 부담하지 않습니다.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surfaceBg },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 40, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '700', color: Colors.textPrimary },
  subtitle: { fontSize: 15, color: Colors.textSecondary, marginTop: 8, marginBottom: 32 },
  form: { gap: 16 },
  inputGroup: { gap: 6 },
  label: { fontSize: 14, fontWeight: '500', color: Colors.textPrimary },
  input: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: Colors.textPrimary,
  },
  // ─── G2: 동의 스타일 ───
  consentBox: {
    backgroundColor: Colors.white,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 12,
    marginTop: 4,
  },
  consentTitle: {
    fontSize: 12, fontWeight: '600', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: 2,
  },
  consentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: Radius.xs,
    borderWidth: 1.5, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.surfaceBg,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary, borderColor: Colors.primary,
  },
  checkmark: { fontSize: 13, color: Colors.white, fontWeight: '700' },
  consentLabel: { flex: 1, fontSize: 13, color: Colors.textPrimary, lineHeight: 19 },
  consentLink: { color: Colors.primary, textDecorationLine: 'underline' },
  required: { color: Colors.error, fontWeight: '600' },
  optional: { color: Colors.textMuted },
  // ─── 버튼 ───
  primaryButton: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
    ...Shadow.elevated,
  },
  disabledButton: { opacity: 0.45 },
  primaryButtonText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
  linkButton: { alignItems: 'center', marginTop: 20 },
  linkText: { color: Colors.textSecondary, fontSize: 14 },
  disclaimerBox: {
    marginTop: 32, padding: 14,
    backgroundColor: Colors.surface, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  disclaimerText: { fontSize: 11, lineHeight: 17, color: Colors.textMuted },
});
