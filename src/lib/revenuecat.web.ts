/**
 * revenuecat.web.ts — RevenueCat 웹 플랫폼 스텁
 * Metro/Expo가 웹 빌드 시 revenuecat.ts 대신 이 파일을 우선 해석 (.web.ts 규칙)
 * 네이티브 바인딩 없는 웹에서 크래시 없이 모든 함수를 no-op/안전값으로 처리
 */

export function isRevenueCatAvailable(): boolean {
  return false;
}

export function configureRevenueCat(): void {}

export async function loginRevenueCat(_userId: string): Promise<void> {}

export async function logoutRevenueCat(): Promise<void> {}

export async function getCustomerInfo(): Promise<null> {
  return null;
}

export async function checkPremiumEntitlement(): Promise<boolean> {
  return false;
}

export async function getTrialStatus(): Promise<{
  isTrialActive: boolean;
  trialEndDate: Date | null;
  trialDaysRemaining: number;
}> {
  return { isTrialActive: false, trialEndDate: null, trialDaysRemaining: 0 };
}

export async function getCurrentOffering(): Promise<null> {
  return null;
}

export async function restorePurchases(): Promise<boolean> {
  return false;
}
