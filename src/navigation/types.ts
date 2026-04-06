/**
 * 네비게이션 타입 정의
 */

export type AuthStackParamList = {
  Welcome: undefined;
  SignUp: undefined;
  SignIn: undefined;
  ForgotPassword: undefined;
};

export type OnboardingStackParamList = {
  BiasAssessment: undefined;
  AssessmentResult: {
    archetype: string;
    biasFlags: Record<string, boolean>;
  };
};

// Main 탭 내부에서 전체 스택으로 push 가능한 화면 목록
export type MainStackParamList = {
  MainTabs: undefined;
  JournalCreate: undefined;
  JournalView: { date?: string };
  PrincipleManage: undefined;
};

// 5-Tab 네비게이터 탭 이름
export type MainTabParamList = {
  홈: undefined;
  일지: undefined;
  원칙: undefined;
  분석: undefined;
  설정: undefined;
};
