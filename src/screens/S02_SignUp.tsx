/**
 * S02 — Sign Up Screen
 * Supabase Auth email/password 회원가입
 * Lock 1: 클라이언트에서 DB 직접 쓰기 금지 — Auth만 처리
 * Lock 6: 회원가입 시 면책 문구 표시
 */

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/colors';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

export default function S02_SignUp({ navigation }: Props) {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

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

    setLoading(true);
    const { error } = await signUp(email.trim(), password);
    setLoading(false);

    if (error) {
      Alert.alert('회원가입 실패', error.message);
    } else {
      Alert.alert('확인', '인증 이메일을 발송했습니다. 이메일을 확인해주세요.', [
        { text: '확인', onPress: () => navigation.navigate('SignIn') },
      ]);
    }
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

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.disabledButton]}
              onPress={handleSignUp}
              disabled={loading}
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
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: Colors.textPrimary,
  },
  primaryButton: {
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  disabledButton: { opacity: 0.6 },
  primaryButtonText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
  linkButton: { alignItems: 'center', marginTop: 20 },
  linkText: { color: Colors.textSecondary, fontSize: 14 },
  disclaimerBox: {
    marginTop: 32, padding: 14,
    backgroundColor: Colors.white, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  disclaimerText: { fontSize: 11, lineHeight: 17, color: Colors.textMuted },
});
