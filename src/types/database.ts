/**
 * INVIT Supabase 테이블 TypeScript 타입 정의
 * 추후 `supabase gen types typescript`로 자동 생성 대체 예정
 */

// ─── Enums ───

export type TradeAction = 'buy' | 'sell' | 'none';

export type TriggerSource =
  | 'onboarding'
  | 'scheduled'
  | 'market_event'
  | 'module_complete'
  | 'user_request';

export type FOMOAlertType = 'surge_standard' | 'plunge_standard';

export type FOMODirection = 'surge' | 'plunge';

export type Archetype =
  | 'panic_reactor'
  | 'overconfident_holder'
  | 'theme_chaser'
  | 'rationalized_biased'
  | 'shortterm_drifter'
  | 'mixed';

export type CoachingSource = 'template' | 'ai_generated';

export type ErrorType =
  | 'validation_error'
  | 'legal_filter_violation'
  | 'rate_limit'
  | 'edge_function_error'
  | 'unknown';

// ─── Bias Assessment ───

export interface BiasAnswers {
  q1: number; // 1-5 손실회피
  q2: number; // 1-5 FOMO
  q3: number; // 1-5 과잉확신
  q4: number; // 1-3 처분효과 (3-point forced choice)
  q5: number; // 1-5 군집행동
  q6: number; // 1-5 현재편향 (역방향: 낮을수록 편향↑)
  q7: number; // 1-5 확증편향
}

export interface BiasFlags {
  loss_aversion: boolean;
  fomo: boolean;
  overconfidence: boolean;
  disposition: boolean;
  herding: boolean;
  present_bias: boolean;
  confirmation: boolean;
}

export interface NextRetestAt {
  loss_aversion: string;  // ISO date
  fomo: string;
  overconfidence: string;
  disposition: string;
  herding: string;
  present_bias: string;
  confirmation: string;
}

// ─── Tables ───

export interface User {
  id: string;
  display_name: string | null;
  bias_profile: BiasFlags | null;
  coaching_archetype: Archetype | null;
  discipline_score: number;
  current_streak: number;
  trial_started_at: string;
  trial_ends_at: string;
  is_premium: boolean;
  created_at: string;
  updated_at: string;
}

export interface BiasAssessment {
  id: string;
  user_id: string;
  version: number;
  answers: BiasAnswers;
  bias_flags: BiasFlags;
  archetype: Archetype;
  next_retest_at: NextRetestAt;
  diagnosed_at: string;
  trigger_source: TriggerSource;
  market_context: Record<string, unknown> | null;
}

export interface InvestmentJournal {
  id: string;
  user_id: string;
  journal_date: string;
  emotion_checkin: number;
  trade_action: TradeAction;
  ticker: string | null;
  amount: number | null;
  trade_rationale: string | null;
  bias_check: boolean | null;
  emotion_memo: string | null;
  principle_checks: Record<string, boolean>;
  created_at: string;
  updated_at: string;
}

export interface DisciplineLog {
  id: string;
  user_id: string;
  log_date: string;
  journal_score: number;
  principle_score: number;
  emotion_score: number;
  total_score: number;
  calculation_detail: Record<string, unknown> | null;
  created_at: string;
}

export interface FOMOAlert {
  id: string;
  user_id: string;
  alert_date: string;
  alert_type: FOMOAlertType;
  kospi_change_pct: number;
  volume_change_pct: number;
  message: string;
  seen_at: string | null;
  dismissed_at: string | null;
  direction: FOMODirection;
  cooldown_until: string;
  created_at: string;
}

export interface CoachingCard {
  id: string;
  user_id: string;
  card_date: string;
  archetype: Archetype;
  content: string;
  source: CoachingSource;
  created_at: string;
}

export interface Principle {
  id: string;
  user_id: string;
  content: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
