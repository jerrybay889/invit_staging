/**
 * useSubscription — RevenueCat 구독 상태 훅
 * Lock 2: feature_flags.subscription = true 시에만 구독 기능 활성화
 *
 * 14일 Reverse Trial 상태:
 *   - isPremium: premium entitlement 활성 여부 (trial 포함)
 *   - isTrialActive: trial 기간 중 여부
 *   - trialDaysRemaining: trial 남은 일수
 *   - isSubscribed: trial 아닌 정식 구독 여부
 */

import { useEffect, useState, useCallback } from 'react';
import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import Purchases from 'react-native-purchases';
import { supabase } from '../lib/supabase';
import {
  checkPremiumEntitlement,
  getTrialStatus,
  getCurrentOffering,
} from '../lib/revenuecat';

export interface SubscriptionState {
  featureEnabled: boolean;
  isPremium: boolean;
  isTrialActive: boolean;
  isSubscribed: boolean;
  trialDaysRemaining: number;
  offering: PurchasesOffering | null;
  loading: boolean;
  purchasing: boolean;
  purchasePremium: () => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useSubscription(): SubscriptionState {
  const [featureEnabled, setFeatureEnabled] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [isTrialActive, setIsTrialActive] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState(0);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  const loadState = useCallback(async () => {
    setLoading(true);

    // feature_flags.subscription 확인 (Lock 2)
    const { data: flagData } = await supabase
      .from('feature_flags')
      .select('enabled')
      .eq('key', 'subscription')
      .single();

    const enabled = flagData?.enabled ?? false;
    setFeatureEnabled(enabled);

    if (!enabled) {
      setLoading(false);
      return;
    }

    // RevenueCat 구독 상태 조회
    const [premium, trialStatus, currentOffering] = await Promise.all([
      checkPremiumEntitlement(),
      getTrialStatus(),
      getCurrentOffering(),
    ]);

    setIsPremium(premium);
    setIsTrialActive(trialStatus.isTrialActive);
    setTrialDaysRemaining(trialStatus.trialDaysRemaining);
    setIsSubscribed(premium && !trialStatus.isTrialActive);
    setOffering(currentOffering);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadState();
  }, [loadState]);

  // 구독 구매
  const purchasePremium = useCallback(async (): Promise<boolean> => {
    if (!offering) return false;

    // $rc_monthly 패키지 우선 탐색
    const monthlyPkg: PurchasesPackage | null =
      offering.monthly ??
      offering.availablePackages.find((p) => p.packageType === 'MONTHLY') ??
      offering.availablePackages[0] ??
      null;

    if (!monthlyPkg) {
      console.error('[useSubscription] No monthly package found');
      return false;
    }

    setPurchasing(true);
    try {
      await Purchases.purchasePackage(monthlyPkg);
      await loadState(); // 구독 상태 갱신
      return true;
    } catch (err: unknown) {
      // 사용자가 취소한 경우 (userCancelled) 에러 무시
      const e = err as { userCancelled?: boolean; message?: string };
      if (!e.userCancelled) {
        console.error('[useSubscription] purchasePackage failed:', e.message);
      }
      return false;
    } finally {
      setPurchasing(false);
    }
  }, [offering, loadState]);

  // 구매 복원
  const restorePurchases = useCallback(async (): Promise<boolean> => {
    setPurchasing(true);
    try {
      await Purchases.restorePurchases();
      await loadState();
      return true;
    } catch (err) {
      console.error('[useSubscription] restorePurchases failed:', err);
      return false;
    } finally {
      setPurchasing(false);
    }
  }, [loadState]);

  return {
    featureEnabled,
    isPremium,
    isTrialActive,
    isSubscribed,
    trialDaysRemaining,
    offering,
    loading,
    purchasing,
    purchasePremium,
    restorePurchases,
    refresh: loadState,
  };
}
