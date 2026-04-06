/**
 * useBiasAssessment — 편향 진단 완료 여부 조회
 * Lock 3: SELECT만 허용. INSERT는 submit-bias-assessment Edge Function 전용.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { BiasAssessment } from '../types/database';
import { useAuth } from './useAuth';

export function useBiasAssessment() {
  const { user } = useAuth();
  const [latestAssessment, setLatestAssessment] = useState<BiasAssessment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLatestAssessment(null);
      setLoading(false);
      return;
    }

    // 초기 조회
    const fetchAssessment = async () => {
      const { data } = await supabase
        .from('bias_assessments')
        .select('*')
        .eq('user_id', user.id)
        .order('diagnosed_at', { ascending: false })
        .limit(1)
        .single();
      setLatestAssessment(data as BiasAssessment | null);
      setLoading(false);
    };

    fetchAssessment();

    // 실시간 구독 (bias_assessments 테이블 변경 감지)
    const subscription = supabase
      .from('bias_assessments')
      .on('*', (payload) => {
        if (payload.new?.user_id === user.id) {
          setLatestAssessment(payload.new as BiasAssessment);
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  return { latestAssessment, hasAssessment: !!latestAssessment, loading };
}
