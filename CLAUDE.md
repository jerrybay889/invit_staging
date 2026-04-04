# CLAUDE.md — INVIT
# Sprint 0 착수 전 최종 확정 | 2026-04-04 | Author: Jerry
# 이 파일은 Claude Code의 모든 구현·판정·리뷰의 SSOT다.
# PRD·Notion 문서는 근거와 맥락이며, 행동 판정은 이 파일이 최종이다.

---

## Executive Summary (5줄 고정)
1. **스택:** React Native + Expo Managed Workflow (Mobile Primary) → React + Vite + Vercel (PC Web, Phase 2) | Supabase (Auth + Postgres + RLS + Edge Functions + pg_cron) | RevenueCat (인앱결제) | GPT-4o-mini + text-embedding-3-small
2. **원칙:** SSOT는 이 파일. Gate Before Go 엄수 — Gate DoD 미통과 시 다음 Sprint 착수 금지. Idempotency 필수 — 모든 일 단위 생성물은 UNIQUE + upsert.
3. **AI 운영:** 클라이언트에서 모델 직접 호출 절대 금지. 모든 LLM/DB쓰기는 Edge Function 단일 진입만 허용.
4. **데이터:** 4계층 분리 엄수 (User-owned / System-generated / Admin / Operational). 클라이언트는 SELECT 전용, INSERT/UPDATE는 service_role Edge Function 독점.
5. **비용·법적·보안은 기능이 아니라 제품의 존재 조건이다.** OpenAI $5/월 차단, 투자자문 금지 필터 Edge 고정, service_role·API Key 클라이언트 노출 즉시 PR 폐기.

---

## System Decision Locks
> Lock은 Jerry 단독 서면 승인 없이 변경 불가. 변경 절차: Notion SSOT Update Log 기록 → Jerry 승인 → 마이그레이션 파일 커밋 → 이 파일 버전 업데이트.

### Lock 1 — AI 호출 경로
- **허용:** Edge Function 경유 호출만 허용 (`generate-coaching`, `check-fomo`, `submit-bias-assessment`).
- **금지:** 클라이언트(React Native 앱)에서 OpenAI API, KRX API, Supabase service_role 직접 호출.
- **위반 시:** 해당 PR 즉시 폐기.
- **검증:** `grep -r "openai" ./src` 결과 0건 유지. CI에서 강제 체크.

### Lock 2 — Feature Flag (리스크 기능 기본 OFF)
- **허용:** Gate 통과 확인 후 `feature_flags` 테이블에서 수동 ON만 허용.
- **금지:** 리스크 기능(FOMO 경보·구독 결제·코칭 AI·재진단 트리거)을 기본 ON 상태로 배포.
- **운영:** `feature_flags` 테이블 (key TEXT, enabled BOOLEAN DEFAULT false). 활성화는 Jerry 승인 후 SQL 직접 업데이트.

### Lock 3 — 데이터 4계층 분리 + RLS 원칙

| 계층 | 테이블 | RLS 원칙 |
|------|--------|----------|
| User-owned | `users`, `investment_journals`, `principles`, `emotion_logs` | SELECT/UPDATE: `auth.uid() = user_id` 만 허용 |
| System-generated | `bias_assessments`, `discipline_logs`, `fomo_alerts`, `coaching_cards` | INSERT/UPDATE: `service_role` 전용. SELECT: `auth.uid() = user_id` |
| Admin-managed | `coaching_knowledge_base`, `archetype_templates` | 모든 클라이언트 쓰기 금지. Admin 역할만 접근 |
| Operational | `ai_call_logs`, `error_logs`, `feature_flags` | 클라이언트 접근 전면 차단 (Edge Function 내부 전용) |

- **RLS 절대 원칙:** 신규 테이블 생성 시 `ENABLE ROW LEVEL SECURITY` 먼저 실행. 정책 미작성 상태의 테이블 배포 금지.

### Lock 4 — Idempotency (중복 생성 방지)
- **허용:** 일 단위 생성물(`discipline_logs`, `fomo_alerts`, `coaching_cards`)은 `UNIQUE(user_id, date)` + upsert (`ON CONFLICT DO UPDATE`) 패턴만 허용.
- **금지:** insert-only 패턴. pg_cron 재실행·재시도에서 중복 레코드 생성 즉시 데이터 오염.

### Lock 5 — 비용 가드레일
- `$3.00/월` → 경고 알림 (ai_call_logs 집계 기반)
- `$5.00/월` → 자동 차단: `generate-coaching` → `return fixed_fallback_message` + `feature_flags.coaching_ai = false`
- **fallback 고정 메시지:** `"오늘의 원칙을 다시 확인해보세요. 일지를 작성하면 내일 새로운 코칭이 준비됩니다."`
- **로깅 필수:** 모든 OpenAI 호출 시 `ai_call_logs` 테이블에 `model`, `input_tokens`, `output_tokens`, `estimated_cost_usd`, `function_name`, `user_id`, `created_at` INSERT.

### Lock 6 — 투자자문 금지 필터 (규제 도메인 Lock)
- **금지 콘텐츠:** `매수 추천`, `매도 추천`, `목표가`, `수익 보장`, `~할 것입니다`, `~오를 것`, `~떨어질 것`, 확정적 가격 예측 표현 전체.
- **필터 위치:** Edge Function `generate-coaching` 내부 후처리 단계에만 위치. 클라이언트 필터링 금지.
- **필터 위반 시:** 해당 응답 저장 금지 + fallback 메시지 반환 + `error_logs`에 `type: 'legal_filter_violation'` 기록.
- **면책 문구 (삭제·축약·위치 변경 금지):**

> [중요 고지사항] 본 진단 결과는 귀하의 투자 행동 패턴에 대한 자기 인식을 돕기 위한 교육적 도구로서, 특정 금융투자상품에 대한 투자 권유, 매수·매도 추천, 또는 투자 적합성 판단을 목적으로 하지 않습니다. 본 서비스는 「자본시장과 금융투자업에 관한 법률」에 따른 투자자문업에 해당하지 않으며, 해당 법률에 따른 등록 투자자문업자의 서비스를 대체하지 않습니다. 진단 결과는 귀하의 행동 경향성을 참고하는 용도로만 사용하시기 바라며, 실제 투자 결정은 귀하 본인의 판단과 책임 하에 이루어져야 합니다. 투자에는 원금 손실의 위험이 있습니다. 본 진단 결과에 기반한 투자 손실에 대하여 (주)글로보더는 법적 책임을 부담하지 않습니다.

### Lock 7 — PII 외부 모델 반출 금지
- **허용:** 사용자 일지 텍스트 → 마스킹/요약 후 모델 전달만 허용.
- **금지:** 실명, 전화번호, 계좌번호, 종목명+수익률 조합(개인 식별 가능), 이메일을 OpenAI API payload에 직접 포함.
- **구현:** Edge Function 내 PII 마스킹 함수 (`maskPII()`) 전처리 후 모델 호출.

---

## Architecture

```
[React Native App (Expo)]
    ↓ JWT Bearer only
[Supabase Edge Functions — 모든 비즈니스로직/AI/DB쓰기 전담]
    ├── submit-bias-assessment  →  bias_assessments (Schema LOCK v1.0)
    ├── calculate-discipline    →  discipline_logs  (LOCK 산식 40/40/20)
    ├── check-fomo              →  fomo_alerts      (Threshold LOCK v1.0)
    └── generate-coaching       →  coaching_cards   (GPT-4o-mini → 법적필터)
    ↓
[Supabase Postgres + pg_cron]
    ↓
[RevenueCat SDK → Apple App Store / Google Play Store]
    ↓
[Expo Push Notifications (FCM + APNs) — FOMO 경보 전용]
```

**불변 원칙:** 클라이언트는 Read (SELECT via anon key) + Edge Function 호출만 허용.

---

## Data Layer

### User-owned (유저 직접 소유 데이터)
```sql
users                  -- auth.uid() 기반 프로필, bias_profile, coaching_archetype
investment_journals    -- 투자 일지 (created_by = auth.uid())
principles             -- 투자 원칙 목록 (user_id = auth.uid())
emotion_logs           -- 감정 슬라이더 기록 (1~5)
```
RLS: `auth.uid() = user_id` — SELECT/UPDATE 본인만. DELETE 금지(soft delete).

### System-generated (Edge Function 독점 생성)
```sql
bias_assessments       -- 편향 진단 결과 (Schema LOCK v1.0 — 변경 금지)
discipline_logs        -- 규율 점수 일일 기록 (UNIQUE user_id + date)
fomo_alerts            -- FOMO 경보 발령 이력 (UNIQUE user_id + date + direction)
coaching_cards         -- AI 코칭 카드 (UNIQUE user_id + date)
```
RLS: INSERT/UPDATE = service_role 전용. SELECT = `auth.uid() = user_id`.

### Operational (앱 외부 비공개)
```sql
ai_call_logs           -- model/tokens/cost/function_name/user_id (비용 계측 필수)
error_logs             -- type/message/stack/user_id/created_at
feature_flags          -- key TEXT, enabled BOOLEAN DEFAULT false
```
RLS: 클라이언트 접근 전면 차단.

### bias_assessments — Schema LOCK v1.0 (변경 절차 없이 손대지 말 것)
```sql
answers       JSONB  -- q1~q7 원본. q4는 1~3 (3-point), q6은 역방향(낮을수록 편향↑)
bias_flags    JSONB  -- Edge Function 자동 산출. GIN 인덱스. 클라이언트 직접 쓰기 금지.
archetype     TEXT   -- 5종 + mixed fallback
next_retest_at JSONB -- 편향별 차등 (fomo/herding +3M, overconfidence +6M, 나머지 +12M)
-- CHECK: q4 BETWEEN 1 AND 3, 나머지 BETWEEN 1 AND 5
-- RLS: SELECT = 본인만, INSERT = service_role 전용
```

---

## Edge Functions Standard (6-Step Pipeline)
모든 Edge Function은 아래 6단계를 순서대로 거쳐야 한다. 단계 생략 금지.

```typescript
// Step 1 — 입력 검증 + Rate Limit
const parsed = validateInput(req.body); // Zod schema 사용
await checkRateLimit(userId, functionName); // 분당 10회 초과 시 429

// Step 2 — 법적·PII 전처리
const safeInput = maskPII(parsed.text);       // PII 마스킹
const filtered = legalPreFilter(safeInput);   // 투자자문 관련 키워드 차단

// Step 3 — 모델 호출 (비용 체크 포함)
const monthlyCost = await getMonthlyAICost(userId);
if (monthlyCost > COST_BLOCK_THRESHOLD) return fallbackResponse(); // Lock 5
const result = await openai.chat(...);

// Step 4 — 후처리 (면책 필터 + 형식 고정 + 스키마 검증)
const postFiltered = legalPostFilter(result); // 금지 표현 제거
const validated = outputSchema.parse(postFiltered); // Zod 출력 검증

// Step 5 — 로그 기록 (생략 불가)
await supabase.from('ai_call_logs').insert({
  model, input_tokens, output_tokens, estimated_cost_usd,
  function_name: 'generate-coaching', user_id, masked_input: safeInput
});

// Step 6 — DB upsert (Idempotency 필수)
await supabase.from('coaching_cards').upsert(
  { user_id, date: today, content: validated },
  { onConflict: 'user_id,date' }
);
```

> Note: `submit-bias-assessment`는 모델 호출이 없으므로 Step 3을 건너뛰고 Step 2 → Step 4로 진행.

---

## Bias Assessment — Schema LOCK v1.0

### 7문항 스키마
| 문항 | 측정 편향 | 척도 | Scoring 방향 | 플래그 임계값 |
|------|----------|------|-------------|-------------|
| Q1 | 손실회피 | 5-point Likert | 높을수록 편향↑ | `q1 >= 4` |
| Q2 | FOMO | 5-point Likert | 높을수록 편향↑ | `q2 >= 4` |
| Q3 | 과잉확신 | 5-point Likert | 높을수록 편향↑ | `q3 >= 4` |
| **Q4** | **처분효과** | **3-point forced choice** | **1=편향 최강, 3=없음** | **`q4 == 1`** |
| Q5 | 군집행동 | 5-point frequency | 높을수록 편향↑ | `q5 >= 4` |
| **Q6** | **현재편향** | **5-point intertemporal** | **낮을수록 편향↑ (역방향)** | **`q6 <= 2`** |
| Q7 | 확증편향 | 5-point Likert | 높을수록 편향↑ | `q7 >= 4` |

### 5종 코칭 아키타입 (판정 우선순위 순)
1. `panic_reactor` — 高 손실회피 + 高 FOMO + 高 군집행동
2. `overconfident_holder` — 高 과잉확신 + 高 확증편향 + 高 처분효과
3. `theme_chaser` — 高 FOMO + 高 군집행동 + 高 현재편향
4. `rationalized_biased` — 中 과잉확신 + 高 확증편향 + 中 처분효과
5. `shortterm_drifter` — 高 현재편향 + 高 손실회피 + 低中 FOMO
6. `mixed` — 위 조건 미충족 fallback

### 재진단 스케줄
| 편향 유형 | 재진단 주기 |
|----------|-----------|
| FOMO, 군집행동 | +3개월 (state-like) |
| 과잉확신 | +6개월 |
| 손실회피, 처분효과, 현재편향, 확증편향 | +12개월 (trait-like) |

---

## Discipline Score — LOCK v1.0

### 산식
```
D_score = (J_score × 0.40) + (P_score × 0.40) + (E_score × 0.20)
```

- **Journal (40%):** `(entry_completed × 50) + (trade_rationale × 30) + (bias_check × 20)`
- **Principle (40%):** `(entry_rule × 40) + (exit_rule × 40) + (no_impulse × 20)`
- **Emotion (20%) — Inverted-V:** `(1 - |emotion_checkin - 3| / 2) × 100`

### 엣지 케이스 (LOCKED)
| 상황 | 처리 |
|------|------|
| 당일 매매 없음 | `entry_rule = true`, `exit_rule = true` 자동 |
| `bias_check = null` | `true` 자동 (페널티 없음) |
| `emotion_checkin` 미입력 | 409 반환, 함수 실행 차단 |
| FOMO 경보 미발동 | `no_impulse = true` 자동 |
| 일지 미작성 (J=0) | 최대 D_score = 60점 상한 |

### UI 표시 기준
| 점수 범위 | 색상 | 메시지 |
|----------|------|--------|
| 0~39 | Red | "오늘 원칙 점검이 필요합니다" |
| 40~69 | Gold | "꾸준히 하고 있습니다" |
| 70~89 | Green | "훌륭합니다!" |
| 90~100 | Teal | "오늘의 원칙 마스터" |

---

## FOMO Thresholds — LOCK v1.0

```typescript
export const FOMO_THRESHOLDS = {
  KOSPI_SURGE_THRESHOLD:  2.0,   // %
  KOSPI_PLUNGE_THRESHOLD: -2.0,  // %
  VOLUME_SURGE_PCT:       150,   // % (20일 이동평균 대비)
  VOLUME_LOOKBACK_DAYS:   20,
  COOLDOWN_HOURS:         24,
  LOCKED_VERSION:         "1.0",
  LOCKED_DATE:            "2026-04-02",
  SOURCE:                 "KCMI-1481 | KRX-2026 | SSRN-3631783",
} as const;

// MVP: standard 2종만 구현. elevated는 Phase 2.
type FOMOAlertType = "surge_standard" | "plunge_standard";
```

### 경보 메시지 2종 (MVP)
- `surge_standard`: "오늘 시장이 크게 올랐습니다. 이런 날 충동 매수한 개인 투자자의 6개월 평균 수익률은 −8.3%입니다. 오늘의 원칙을 먼저 확인해 보세요."
- `plunge_standard`: "오늘 시장이 크게 떨어졌습니다. '지금이 기회'라는 감정은 손실회피 편향 신호입니다. 충동 매수 전 원칙 일지를 먼저 기록하세요."

---

## Color System
| 토큰 | HEX | 용도 |
|------|-----|------|
| Primary (Hydra Teal) | `#01696F` | 행동 완료, 규율 강화 CTA |
| Warning (Costa Orange) | `#DA7101` | FOMO 경보, 주의 신호 |
| Error (Jenova Maroon) | `#A12C7B` | 편향 위험 강도 '높음' |
| Success (Gridania Green) | `#437A22` | 원칙 준수 확인 |
| Surface BG (Nexus Beige) | `#F7F6F2` | 기본 배경 |
| Text Primary (Sylph Gray) | `#28251D` | 본문 텍스트 |

---

## Project Structure
```
invit/
├── CLAUDE.md              # 이 파일 (SSOT)
├── .gitignore
├── .env.example
├── app.json
├── package.json
├── tsconfig.json
├── src/
│   ├── types/
│   │   ├── database.ts    # Supabase 테이블 TypeScript 타입
│   │   └── ai-feedback.ts # 코칭 응답 스키마
│   ├── constants/
│   │   ├── fomo-thresholds.ts  # FOMO_THRESHOLDS LOCK
│   │   ├── discipline.ts      # 가중치 상수
│   │   └── archetype.ts       # 5종 + mixed 정의
│   ├── lib/
│   │   └── supabase.ts   # Supabase 클라이언트 (anon key)
│   ├── screens/           # S01~S04, H01, J01 등
│   └── components/        # 공통 UI 컴포넌트
├── supabase/
│   ├── migrations/        # SQL DDL 마이그레이션
│   └── functions/         # Edge Functions (Deno)
│       └── submit-bias-assessment/
└── assets/
```

---

## Sprint Roadmap (3-Sprint 압축)

| Sprint | 기간 | 핵심 산출물 | Gate 조건 |
|--------|------|------------|----------|
| **S0** (인프라+온보딩) | 2주 | Git 초기화, Supabase 7테이블 마이그레이션, Auth, 온보딩 7문항 UI (S01~S04) + submit-bias-assessment EF | Schema LOCK DDL 적용 완료 + RLS 전 테이블 활성화 |
| **S1** (일지+규율+코칭) | 2주 | 일지 작성/조회 (J01~J02), calculate-discipline EF, generate-coaching EF (단순 DB 조회), 홈 대시보드 (H01), 원칙 관리 (P01) | 규율 점수 산출 E2E 1회전 성공 |
| **S2** (FOMO+결제+베타) | 2주 | check-fomo EF (standard 2종), RevenueCat 14일 Reverse Trial, Push 알림, TestFlight 내부 베타 | FOMO 경보 발송 + 결제 플로우 작동 |

---

## MVP Scope 축소 항목 (Phase 2 이관)
- ~~NAVER CLOVA Studio~~ → GPT-4o-mini 단일 모델
- ~~pgvector RAG~~ → 아키타입별 코칭 템플릿 DB 조회
- ~~elevated 경보 (Layer 3)~~ → standard 2종만
- ~~Dark Mode~~ → Phase 2
- ~~오프라인 sync~~ → Phase 2
- ~~감정 캘린더 컬러맵~~ → Phase 2
- ~~코칭 모듈 진행률~~ → Phase 2

---

## Non-Goals (영구 금지)
- 종목 추천 / 매수·매도 권고 / 가격 예측 (자본시장법)
- 사용자 투자 데이터 외부 AI 학습 데이터 제공 (PIPA)
- 클라이언트 직접 LLM 호출
- service_role 키 클라이언트 노출
