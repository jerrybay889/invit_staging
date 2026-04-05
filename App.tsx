/**
 * App.tsx — INVIT 루트 네비게이션
 *
 * Auth 상태에 따라 3가지 스택 전환:
 * 1. 미로그인 → AuthStack (S01~S04)
 * 2. 로그인 + 편향진단 미완료 → OnboardingStack (7문항)
 * 3. 로그인 + 편향진단 완료 → MainTabs (홈/일지/설정)
 */

import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
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

const AuthStack = createNativeStackNavigator();
const OnboardingStack = createNativeStackNavigator();
const MainStack = createNativeStackNavigator();

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

function MainNavigator() {
  return (
    <MainStack.Navigator screenOptions={{ headerShown: false }}>
      <MainStack.Screen name="Home" component={H01_Home} />
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
});
