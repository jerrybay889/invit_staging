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

export type MainStackParamList = {
  Home: undefined;
  JournalCreate: undefined;
  JournalView: { date?: string };
  PrincipleManage: undefined;
};
