/**
 * revenuecat.ts — RevenueCat SDK 초기화 및 헬퍼
 * Lock 1: 결제 로직은 이 파일을 통해서만 접근
 * Lock 2: feature_flags.subscription = true 시에만 구독 기능 활성화
 *
 * 14일 Reverse Trial:
 *   - 설치 즉시 premium entitlement 14일 무료 제공
 *   - RevenueCat 대시보드에서 Trial 설정 필요 (이미 완료)
 *   - Trial 종료 후 구독 전환 시 ₩9,900/월 과금
 */

import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
} from 'react-native-purchases';
import { Platform } from 'react-native';

const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? '';
const PREMIUM_ENTITLEMENT_ID = 'premium';

let configured = false;

/**
 * RevenueCat SDK 초기화 — App 시작 시 1회 호출
 */
export function configureRevenueCat(): void {
  if (configured) return;
  if (!REVENUECAT_API_KEY) {
    console.warn('[RevenueCat] EXPO_PUBLIC_REVENUECAT_API_KEY not set');
    return;
  }

  // 개발 환경에서는 DEBUG 로그 활성화
  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }

  Purchases.configure({ apiKey: REVENUECAT_API_KEY });
  configured = true;
}

/**
 * 로그인 시 RevenueCat 사용자 연결 — Supabase user.id를 RC 앱 사용자 ID로 사용
 */
export async function loginRevenueCat(userId: string): Promise<void> {
  if (!configured) {
    configureRevenueCat();
  }
  try {
    await Purchases.logIn(userId);
  } catch (err) {
    console.error('[RevenueCat] logIn failed:', err);
  }
}

/**
 * 로그아웃 시 RevenueCat 사용자 해제
 */
export async function logoutRevenueCat(): Promise<void> {
  try {
    await Purchases.logOut();
  } catch (err) {
    console.error('[RevenueCat] logOut failed:', err);
  }
}

/**
 * 현재 CustomerInfo 조회
 */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  try {
    return await Purchases.getCustomerInfo();
  } catch (err) {
    console.error('[RevenueCat] getCustomerInfo failed:', err);
    return null;
  }
}

/**
 * premium entitlement 활성 여부 확인
 */
export async function checkPremiumEntitlement(): Promise<boolean> {
  const info = await getCustomerInfo();
  if (!info) return false;
  return info.entitlements.active[PREMIUM_ENTITLEMENT_ID] !== undefined;
}

/**
 * Trial 상태 조회
 * - isTrialActive: 현재 trial 중 여부
 * - trialEndDate: trial 종료일 (없으면 null)
 * - trialDaysRemaining: 남은 trial 일수
 */
export async function getTrialStatus(): Promise<{
  isTrialActive: boolean;
  trialEndDate: Date | null;
  trialDaysRemaining: number;
}> {
  const info = await getCustomerInfo();
  if (!info) {
    return { isTrialActive: false, trialEndDate: null, trialDaysRemaining: 0 };
  }

  const entitlement = info.entitlements.active[PREMIUM_ENTITLEMENT_ID];
  if (!entitlement) {
    return { isTrialActive: false, trialEndDate: null, trialDaysRemaining: 0 };
  }

  const isTrialActive = entitlement.periodType === 'TRIAL';
  const expirationDateStr = entitlement.expirationDate;
  const trialEndDate = expirationDateStr ? new Date(expirationDateStr) : null;
  const trialDaysRemaining = trialEndDate
    ? Math.max(0, Math.ceil((trialEndDate.getTime() - Date.now()) / 86_400_000))
    : 0;

  return { isTrialActive, trialEndDate, trialDaysRemaining };
}

/**
 * 현재 Offering 조회 ($rc_monthly 패키지 포함)
 */
export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current;
  } catch (err) {
    console.error('[RevenueCat] getOfferings failed:', err);
    return null;
  }
}

/**
 * 구매 복원 (기존 구독 복원)
 */
export async function restorePurchases(): Promise<boolean> {
  try {
    await Purchases.restorePurchases();
    return true;
  } catch (err) {
    console.error('[RevenueCat] restorePurchases failed:', err);
    return false;
  }
}
