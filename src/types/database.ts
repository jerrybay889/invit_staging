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

// 매매 이유 태그 (J01 매매일 일지 다중선택) — 마스터플랜 Pillar 1
export type TradeReasonTag =
  | 'earnings'        // 실적 기대
  | 'technical'       // 기술적 매수
  | 'principle'       // 원칙에 따라
  | 'fomo'            // FOMO
  | 'youtube'         // 유튜브/뉴스 영향
  | 'split'           // 분할매수 계획
  | 'stoploss'        // 손절 원칙 준수
  | 'other';          // 기타

// 원칙 준수 여부 (UI: O / △ / X)
export type PrincipleCompliance = 'kept' | 'partial' | 'broken';

// 마스터 원칙 출처 Tier
export type PrincipleSourceTier = 'global' | 'kr' | 'invit';

// 시황/콘텐츠 소스 유형
export type ContentSourceType = 'youtube_channel' | 'news_site' | 'web_link';

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

// PIPA 동의 감사 기록 (migration 023)
export interface UserConsent {
  tos_at: string;       // ISO8601
  privacy_at: string;   // ISO8601
  privacy_version: string;
  marketing: boolean;
}

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
  // G2: PIPA 동의 + G1: 계정 상태 (migration 023)
  consent: UserConsent | null;
  status: 'active' | 'deleted';
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
  // ── 마스터플랜 0617 Pillar 1 확장 (마이그레이션 011, 모두 nullable) ──
  has_trade?: boolean | null;
  impulse_buy_ticker?: string | null;   // 사고 싶었지만 참은 종목
  impulse_sell_ticker?: string | null;  // 팔고 싶었지만 참은 종목
  trade_reason_tags?: TradeReasonTag[] | null;
  principle_compliance?: PrincipleCompliance | null;
  entry_duration_seconds?: number | null;
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

// ─── 마스터플랜 0617 신규 테이블 ───

// Pillar 1 — 종목 캐시 (마이그레이션 011 + 029 하드닝 + 030 자산유형)
export type AssetType = 'STOCK' | 'ETF' | 'ETN' | 'ELW' | 'REITS';
export type ProductSubtype =
  | 'VANILLA' | 'LEVERAGE_2X' | 'LEVERAGE_3X'
  | 'INVERSE_1X' | 'INVERSE_2X' | 'ACTIVE_MGMT' | 'THEMED';

export interface Stock {
  code: string;
  name: string;
  market: string;  // KOSPI | KOSDAQ | ETF | KONEX | ETN
  type: string;    // stock | etf | etn | reit (legacy)
  is_active: boolean;
  updated_at: string;
  // 029 Phase A
  isin?: string | null;
  listing_status?: string; // ACTIVE | CAUTION | ADMINISTRATIVE | HALTED | DELISTING_PENDING | DELISTED | MATURED
  search_enabled?: boolean;
  recommendation_enabled?: boolean;
  row_hash?: string | null;
  source_system?: string;  // KRX_DATAGO | KRX_DATAGO_ETF | KRX_DATAGO_ETN
  source_as_of_date?: string | null;
  first_seen_at?: string | null;
  last_changed_at?: string | null;
  delisted_at?: string | null;
  // 030 Phase A+ 자산유형 거버넌스
  asset_type?: AssetType;
  product_subtype?: ProductSubtype | null;
  underlying_index?: string | null;
  issuer?: string | null;
  maturity_date?: string | null;   // ISO date (ETN 만기일)
  listing_shares?: number | null;  // 상장좌수
}

// Pillar 2 — 글로벌 투자원칙 마스터 DB (마이그레이션 012)
export interface PrincipleMaster {
  id: string;
  title: string;
  title_en: string | null;
  body_text: string;
  source_author: string;
  source_author_en: string | null;
  source_ref: string | null;
  source_tier: PrincipleSourceTier;
  bias_tags: string[];
  market_phase_tags: string[];
  behavior_tags: string[];
  style_tags: string[];
  tier: number;
  is_verified: boolean;
  is_active: boolean;
  usage_count: number;
  user_save_count: number;
  created_at: string;
  last_reviewed_at: string;
}

// Pillar 3 — 일일 시황 브리핑 (마이그레이션 013)
export interface DailyBriefing {
  id: string;
  briefing_date: string;
  source_channel: string | null;
  source_url: string | null;
  source_title: string | null;
  brief_title: string;
  summary: string;
  key_sectors: string[];
  risk_signals: string | null;
  principle_hint: string | null;
  bias_warning: string | null;
  linked_principle_id: string | null;
  auto_approved: boolean;
  published_at: string | null;
  created_at: string;
}

// Pillar 3 — 콘텐츠 소스 레지스트리 (마이그레이션 013, Operational)
export interface ContentSource {
  id: string;
  name: string;
  type: ContentSourceType;
  url: string | null;
  channel_id: string | null;
  trigger_schedule: string | null;
  priority_level: number;
  auto_publish: boolean;
  is_active: boolean;
  last_crawled_at: string | null;
  last_success_at: string | null;
  created_at: string;
}
