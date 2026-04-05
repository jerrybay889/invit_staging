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

    supabase
      .from('bias_assessments')
      .select('*')
      .eq('user_id', user.id)
      .order('diagnosed_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        setLatestAssessment(data as BiasAssessment | null);
        setLoading(false);
      });
  }, [user]);

  return { latestAssessment, hasAssessment: !!latestAssessment, loading };
}
