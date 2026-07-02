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

import React, { useEffect, useRef, Component, type ReactNode } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, LogBox, ScrollView, Platform } from 'react-native';

// Crash 원인 파악용 ErrorBoundary — 다음 빌드에서 제거 예정
class CrashDisplay extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <View style={[styles.root, { backgroundColor: '#fff', padding: 24, paddingTop: 60 }]}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#c00', marginBottom: 12 }}>
            앱 충돌 — 에러 내용 (스크린샷 찍어 전달)
          </Text>
          <ScrollView>
            <Text style={{ fontSize: 12, fontFamily: 'monospace', color: '#333' }}>
              {String(this.state.error)}{'\n\n'}
              {(this.state.error as Error).stack ?? '(no stack)'}
            </Text>
          </ScrollView>
        </View>
      );
    }
    return <View style={styles.root}>{this.props.children}</View>;
  }
}

// RevenueCat API Key는 T1-5에서 정식 키로 교체 예정 — 개발 중 LogBox 팝업 억제
LogBox.ignoreLogs(['[RevenueCat]']);
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { useBiasAssessment } from './src/hooks/useBiasAssessment';
import { Colors } from './src/constants/colors';
import { configureRevenueCat } from './src/lib/revenuecat';
import { isSupabaseConfigured } from './src/lib/supabase';
import * as Notifications from 'expo-notifications';

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
import IN01_Insights from './src/screens/IN01_Insights';
import SubscriptionScreen from './src/screens/SubscriptionScreen';

import type { MainStackParamList, MainTabParamList } from './src/navigation/types';
// lib/notifications.ts 모듈 임포트가 setNotificationHandler를 1회 설정 (중복 등록 방지)
import './src/lib/notifications';
import PhonePreviewFrame from './src/components/PhonePreviewFrame';

const AuthStack = createNativeStackNavigator();
const OnboardingStack = createNativeStackNavigator();
const MainStack = createNativeStackNavigator<MainStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

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
  const insets = useSafeAreaInsets();
  // 웹 미리보기: safe area bottom padding 추가 (탭바 하단 여백 확보)
  const bottomInset = Platform.OS === 'web' ? 16 : insets.bottom;
  const tabBarHeight = 56 + bottomInset;

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
          height: tabBarHeight,
          paddingBottom: bottomInset + 6,
          paddingTop: 6,
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
      <Tab.Screen name="분석" component={IN01_Insights} />
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
      <MainStack.Screen
        name="Subscription"
        component={SubscriptionScreen}
        options={{ headerShown: true, title: '구독 관리', headerBackTitle: '뒤로' }}
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
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  // RevenueCat SDK 초기화 — 앱 시작 시 1회 실행 (Invalid API Key는 비치명적 — 구독 기능만 비활성)
  useEffect(() => {
    try {
      configureRevenueCat();
    } catch {
      console.warn('[RevenueCat] init failed — subscription features unavailable');
    }
  }, []);

  // 포그라운드 알림 핸들러 — FOMO 경보 전용 (Lock 2: fomo_alert flag=true 시 발송)
  useEffect(() => {
    notificationListener.current = Notifications.addNotificationReceivedListener(_notification => {
      // setNotificationHandler가 shouldShowAlert:true이므로 배너 자동 표시
      // H01_Home은 useFocusEffect로 data refetch → FOMO 배너 자동 갱신
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(_response => {
      // 사용자가 알림을 탭한 경우 — H01_Home이 onFocus 시 fomo_alerts SELECT로 배너 표시
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  // 환경변수 누락 시 침묵 크래시 대신 명확한 안내 화면 (EAS env 미주입 방어)
  if (!isSupabaseConfigured) {
    return (
      <View style={styles.envError}>
        <Text style={styles.envErrorTitle}>환경설정 누락</Text>
        <Text style={styles.envErrorBody}>
          이 빌드에 Supabase 환경변수(EXPO_PUBLIC_SUPABASE_URL / ANON_KEY)가{'\n'}
          주입되지 않았습니다.{'\n\n'}
          EAS 환경변수를 설정한 뒤 다시 빌드해야 합니다.{'\n'}
          (eas env:push preview / production)
        </Text>
      </View>
    );
  }

  return (
    <CrashDisplay>
      {Platform.OS === 'web' ? (
        // 웹: 폰 프레임 없이 전체 화면 사용
        <SafeAreaProvider>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </SafeAreaProvider>
      ) : (
        // 네이티브: 폰 프레임 유지
        <PhonePreviewFrame>
          <SafeAreaProvider>
            <AuthProvider>
              <RootNavigator />
            </AuthProvider>
          </SafeAreaProvider>
        </PhonePreviewFrame>
      )}
    </CrashDisplay>
  );
}

const styles = StyleSheet.create({
  root: Platform.OS === 'web' ? {
    flex: 1,
    height: '100vh' as any,
    overflow: 'hidden' as any,
  } : {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surfaceBg,
  },
  envError: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surfaceBg,
    paddingHorizontal: 32,
  },
  envErrorTitle: {
    fontSize: 22, fontWeight: '800', color: Colors.error, marginBottom: 16,
  },
  envErrorBody: {
    fontSize: 14, color: Colors.textPrimary, textAlign: 'center', lineHeight: 22,
  },
});

