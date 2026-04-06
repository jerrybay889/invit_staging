/**
 * useFomoAlert — 오늘의 미확인 FOMO 경보 조회
 * Lock 3: fomo_alerts SELECT = auth.uid() = user_id (anon 허용)
 * Lock 3: fomo_alerts seen_at UPDATE = anon 본인만 허용 (RLS 정책)
 * Lock 2: feature_flags.fomo_alert = true일 때만 경보 표시
 */

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { FOMOAlert } from '../types/database';

export function useFomoAlert() {
  const { user } = useAuth();
  const [alert, setAlert] = useState<FOMOAlert | null>(null);
  const [featureEnabled, setFeatureEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchAlert = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    const today = new Date().toISOString().split('T')[0];

    // feature_flags.fomo_alert 확인 (Lock 2)
    const { data: flagData } = await supabase
      .from('feature_flags')
      .select('enabled')
      .eq('key', 'fomo_alert')
      .single();

    const enabled = flagData?.enabled ?? false;
    setFeatureEnabled(enabled);

    if (!enabled) {
      setLoading(false);
      return;
    }

    // 오늘 미확인 FOMO 경보 조회 (seen_at IS NULL)
    const { data } = await supabase
      .from('fomo_alerts')
      .select('*')
      .eq('user_id', user.id)
      .eq('alert_date', today)
      .is('seen_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    setAlert(data as FOMOAlert | null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAlert();
  }, [fetchAlert]);

  // "확인" 버튼 클릭 시 seen_at 업데이트
  const dismissAlert = useCallback(async () => {
    if (!alert || !user) return;

    const now = new Date().toISOString();

    // Lock 3: fomo_alerts seen_at은 anon 본인 UPDATE 허용 (RLS 정책)
    const { error } = await supabase
      .from('fomo_alerts')
      .update({ seen_at: now })
      .eq('id', alert.id)
      .eq('user_id', user.id);

    if (!error) {
      setAlert(null);
    }
  }, [alert, user]);

  return {
    alert,
    featureEnabled,
    loading,
    dismissAlert,
    refetch: fetchAlert,
  };
}
