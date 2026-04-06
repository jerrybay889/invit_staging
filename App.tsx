/**
 * App.tsx — INVIT 루트 네비게이션
 *
 * Auth 상태에 따라 3가지 스택 전환:
 * 1. 미로그인 → AuthStack (S01~S04)
 * 2. 로그인 + 편향진단 미완료 → OnboardingStack (7문항)
 * 3. 로그인 + 편향진단 완료 → MainStack (5-Tab + 모달 화면)
 *
 * MainStack 구조:
 *   MainTabs (Bottom 5-Tab)
 *     탭1: 홈 (H01_Home)
 *     탭2: 일지 (J02_JournalHistory)
 *     탭3: 원칙 (P01_PrincipleManage)
 *     탭4: 분석 (준비 중 Placeholder)
 *     탭5: 설정 (ST01_Settings)
 *   + JournalCreate  (탭 위 풀스크린)
 *   + JournalView    (탭 위 풀스크린)
 *   + PrincipleManage (탭 위 풀스크린 — Home 퀵액션용)
 */

import React from 'react';
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { useBiasAssessment } from './src/hooks/useBiasAssessment';
import { Colors } from './src/constants/colors';

// Auth Screens
import S01_Welcome from './src/screens/S01_Welcome';
import S02_SignUp from './src/screens/S02_SignUp';
import S03_SignIn from './src/screens/S03_SignIn';
import S04_ForgotPassword from './src/screens/S04_ForgotPassword';

// Onboarding Screens
import BiasAssessmentScreen from './src/screens/onboarding/BiasAssessmentScreen';
import AssessmentResultScreen from './src/screens/onboarding/AssessmentResultScreen';

// Main Screens
import H01_Home from './src/screens/H01_Home';
import J01_JournalCreate from './src/screens/J01_JournalCreate';
import J02_JournalHistory from './src/screens/J02_JournalHistory';
import J02_JournalView from './src/screens/J02_JournalView';
import P01_PrincipleManage from './src/screens/P01_PrincipleManage';
import ST01_Settings from './src/screens/ST01_Settings';

import type { MainStackParamList, MainTabParamList } from './src/navigation/types';

const AuthStack = createNativeStackNavigator();
const OnboardingStack = createNativeStackNavigator();
const MainStack = createNativeStackNavigator<MainStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// 분석 탭 준비 중 플레이스홀더
function InsightsPlaceholder() {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderEmoji}>📊</Text>
      <Text style={styles.placeholderTitle}>분석 준비 중</Text>
      <Text style={styles.placeholderDesc}>
        편향 프로파일과 규율 트렌드 차트가{'\n'}다음 업데이트에서 제공됩니다
      </Text>
    </View>
  );
}

// 탭 아이콘 (텍스트 기반 — expo vector icons 없이)
function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    홈: '🏠', 일지: '📓', 원칙: '📋', 분석: '📊', 설정: '⚙️',
  };
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.45 }}>
      {icons[label] ?? '●'}
    </Text>
  );
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Welcome" component={S01_Welcome} />
      <AuthStack.Screen name="SignUp" component={S02_SignUp} />
      <AuthStack.Screen name="SignIn" component={S03_SignIn} />
      <AuthStack.Screen name="ForgotPassword" component={S04_ForgotPassword} />
    </AuthStack.Navigator>
  );
}

function OnboardingNavigator() {
  return (
    <OnboardingStack.Navigator screenOptions={{ headerShown: false }}>
      <OnboardingStack.Screen name="BiasAssessment" component={BiasAssessmentScreen} />
      <OnboardingStack.Screen name="AssessmentResult" component={AssessmentResultScreen} />
    </OnboardingStack.Navigator>
  );
}

function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => (
          <TabIcon label={route.name} focused={focused} />
        ),
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: Colors.border,
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      })}
    >
      <Tab.Screen name="홈" component={H01_Home} />
      <Tab.Screen name="일지" component={J02_JournalHistory} />
      <Tab.Screen name="원칙" component={P01_PrincipleManage} />
      <Tab.Screen name="분석" component={InsightsPlaceholder} />
      <Tab.Screen name="설정" component={ST01_Settings} />
    </Tab.Navigator>
  );
}

function MainNavigator() {
  return (
    <MainStack.Navigator screenOptions={{ headerShown: false }}>
      {/* 탭 네비게이터가 메인 진입점 */}
      <MainStack.Screen name="MainTabs" component={MainTabNavigator} />

      {/* 탭 위 풀스크린 화면 (탭바 숨김) */}
      <MainStack.Screen
        name="JournalCreate"
        component={J01_JournalCreate}
        options={{ headerShown: true, title: '일지 작성', headerBackTitle: '뒤로' }}
      />
      <MainStack.Screen
        name="JournalView"
        component={J02_JournalView}
        options={{ headerShown: true, title: '일지 확인', headerBackTitle: '뒤로' }}
      />
      <MainStack.Screen
        name="PrincipleManage"
        component={P01_PrincipleManage}
        options={{ headerShown: true, title: '원칙 관리', headerBackTitle: '뒤로' }}
      />
    </MainStack.Navigator>
  );
}

function RootNavigator() {
  const { user, loading: authLoading } = useAuth();
  const { hasAssessment, loading: assessmentLoading } = useBiasAssessment();

  if (authLoading || (user && assessmentLoading)) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!user ? (
        <AuthNavigator />
      ) : !hasAssessment ? (
        <OnboardingNavigator />
      ) : (
        <MainNavigator />
      )}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surfaceBg,
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surfaceBg,
    paddingHorizontal: 32,
  },
  placeholderEmoji: { fontSize: 52, marginBottom: 16 },
  placeholderTitle: {
    fontSize: 20, fontWeight: '700', color: Colors.textPrimary, marginBottom: 10,
  },
  placeholderDesc: {
    fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 22,
  },
});
