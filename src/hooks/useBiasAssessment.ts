/**
 * useBiasAssessment — 편향 진단 완료 여부 조회
 * Lock 3: SELECT만 허용. INSERT는 submit-bias-assessment Edge Function 전용.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { onAssessmentRefetch } from '../lib/assessmentRefetch';
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

    // 실시간 구독 (bias_assessments INSERT 감지)
    const channel = supabase
      .channel(`bias_assessments:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bias_assessments',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setLatestAssessment(payload.new as BiasAssessment);
        }
      )
      .subscribe();

    // AssessmentResultScreen의 "시작하기" 버튼이 triggerAssessmentRefetch()를 호출하면
    // fetchAssessment를 다시 실행하여 hasAssessment=true 전환을 보장
    const unsubscribe = onAssessmentRefetch(fetchAssessment);

    return () => {
      supabase.removeChannel(channel);
      unsubscribe();
    };
  }, [user]);

  return { latestAssessment, hasAssessment: !!latestAssessment, loading };
}
