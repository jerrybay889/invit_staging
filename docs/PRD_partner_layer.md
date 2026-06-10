# PRD: INVIT × 주식아가방 파트너 레이어 v1

> 작성: 2026-06-10 | 작성자: Claude Code | 상태: **계획 확정본 (구현 착수는 Jerry LOI 신호 후)**
> 근거: Notion CTO 보강안(T3 실행 스펙) + 향후 작업 방향성 확정(0610) + 코드베이스 실측 (2026-06-10)
> 구현 체크리스트는 [SPRINT_PLAN.md](./SPRINT_PLAN.md) [C] 섹션 참조.

---

## 1. 개요

- **목적:** 주식아가방(이광수·박시동) 12시 본방의 투자 원칙을 구조화된 DB(`partner_principles`)로 적재하고, 사용자의 투자 일지·편향 프로파일과 결합해 Claude Haiku 기반 개인화 코칭을 생성한다. 원래 비어 있던 Phase 2 AI 슬롯(generate-coaching의 `model:'none'` 자리)에 첫 번째 파트너 콘텐츠를 입주시키는 작업이며, 아키텍처 교체가 아니라 예정된 개발의 콘텐츠 교체다.
- **서비스 정체성 선언 (LOCK):** INVIT은 '투자 행동교정 앱'이며 이 정체성은 파트너와 무관하게 고정된다.
- **파트너 포지셔닝:** 주식아가방은 파트너 플러그인 슬롯의 1호 입주자일 뿐, 서비스 정체성·브랜드·데이터 주도권은 INVIT가 보유한다 (파트너 ≠ 서비스 정체성).

---

## 2. 아키텍처 다이어그램 (텍스트 형식)

```
        [ INVIT 코어 = 변하지 않는 본체 ]
   편향진단 7문항 · D-Score · FOMO · 투자일지 · 5-Tab
   (bias_assessments Schema LOCK / FOMO_THRESHOLDS LOCK /
    discipline 40·40·20 LOCK / 면책 문구 LOCK)
                      │
          ┌───────────┴───────────┐
          │   파트너 플러그인 슬롯   │  ← 원래 비어있던 Phase 2 AI 자리
          │  partner_principles    │     (generate-coaching model:'none')
          │  + Claude Haiku 코칭   │
          └───────────┬───────────┘
        ┌─────────────┼─────────────┬──────────────┐
   [주식아가방]    [한경TV]      [증권사]      [역사적 大家]
    1호 입주자    (대기)        (대기)       (확장)
   이광수·박시동   KTOP10 등     화이트라벨    버핏·달리오 등
```

- 파트너 교체/추가는 `partner_principles.partner_id` 행 추가만으로 처리. 코어 테이블·LOCK 항목은 건드리지 않는다.
- 계약 종료 시에도 남는 자산: 구조화된 원칙 DB + 행동–원칙 매칭 데이터 (콘텐츠가 아니라 구조가 자산).

---

## 3. DB 스키마 변경사항 (마이그레이션 011/012)

> 컨벤션: 기존 001~010과 동일 — `uuid` PK(`gen_random_uuid()`), `public.` 스키마, `CREATE TABLE IF NOT EXISTS`, 테이블 생성 직후 `ENABLE ROW LEVEL SECURITY`, 명명된 정책. (CTO 보강안의 BIGSERIAL 초안은 기존 컨벤션에 맞춰 uuid로 정제)

### 3-1. `partner_principles` 테이블 (011)

| 컬럼 | 타입 | 설명 | nullable |
|------|------|------|----------|
| `id` | uuid PK | `gen_random_uuid()` | NO |
| `partner_id` | text | 파트너 식별자. v1: `'jagabang'` | NO |
| `principle_text` | text | 원칙 본문 (검수 완료본만 입력) | NO |
| `principle_category` | text | `'discipline'` \| `'fomo_response'` \| `'risk_management'` | YES |
| `coach_persona` | text | `'lee_kwang_soo'` \| `'park_si_dong'` \| NULL(공통) | YES |
| `broadcast_date` | date | 출처 본방 날짜 (12시 본방 앵커) | YES |
| `market_context` | text | 시장 국면 메타 (예: '급등장', '횡보') | YES |
| `is_active` | boolean | DEFAULT true | NO |
| `created_at` | timestamptz | DEFAULT now() | NO |

- **RLS 정책:**
  - SELECT: `USING (is_active = true)` — 인증 클라이언트 읽기 허용 (archetype_templates와 동일 패턴)
  - INSERT/UPDATE/DELETE: service_role 전용 (클라이언트 쓰기 전면 금지 — Admin-managed 계층)
- **인덱스 권장:** `(partner_id, principle_category, is_active)` 복합 인덱스 — generate-coaching 조회 경로 / `(partner_id, broadcast_date DESC)` — AR01 아카이브 날짜순 조회
- **시드:** 주식아가방 원칙 5종 (Jerry 검수 후 011에 포함. 콘텐츠 입력은 수동 — 자동 파이프라인은 T4 이후)

### 3-2. `behavior_cohorts` 테이블 (011)

| 컬럼 | 타입 | 설명 | nullable |
|------|------|------|----------|
| `id` | uuid PK | `gen_random_uuid()` | NO |
| `cohort_key` | text | 집계 그룹 키 (예: `'fomo_high_age_20s'`) | NO |
| `cohort_date` | date | 집계 대상일 | NO |
| `users_in_cohort` | integer | 코호트 인원수 | NO |
| `avg_discipline_score` | numeric(4,1) | 평균 D-Score | YES |
| `buy_ratio` | numeric(4,2) | 매수 행동 비율 | YES |
| `sell_ratio` | numeric(4,2) | 매도 행동 비율 | YES |
| `bias_flag_distribution` | jsonb | 코호트 내 편향 플래그별 비율 (예: `{"fomo":0.62,"loss_aversion":0.41,"herding":0.35}`) — **AN01 블록2 "유사군 편향 프로파일" 소스 (P-02)** | YES |
| `created_at` | timestamptz | DEFAULT now() | NO |
| — | UNIQUE | `(cohort_key, cohort_date)` — pg_cron 재실행 대비 Idempotency (Lock 4) | |

- **RLS 정책 (N≥5 필터 — PIPA 핵심):**
  - SELECT: `USING (users_in_cohort >= 5)` — N<5 행은 RLS 레벨에서 차단 (클라이언트 필터링에 의존하지 않음)
  - INSERT/UPDATE: service_role 전용 (집계 작업은 pg_cron + EF에서만)
- **PIPA 준수 사항:**
  - 개인 단위 원본 데이터는 이 테이블에 저장하지 않는다. 집계값만 적재.
  - 집계 생성 시점에 N≥5 미달 코호트는 행 자체를 생성하지 않는 것을 원칙으로 하고, RLS는 2차 방어선.
  - N 기준값(≥5)은 Jerry 운영 결정으로 상향 가능 (8장 참조).

### 3-2a. `behavior_cohorts` 집계 메커니즘 (P-01 — 신규 EF + pg_cron)

> §3-2 테이블을 채우는 주체. 클라이언트·앱은 이 테이블에 절대 쓰지 않는다 (SELECT 전용, Lock 3).

- **집계 EF: `aggregate-cohorts` (신규, service_role 전용).**
  - **소스:** `discipline_logs`(전일 D-Score·행동) + `investment_journals`(전일 trade_action) + `bias_assessments.bias_flags`(코호트 분류 기준). 전부 **익명 집계** — 개인 행/식별자는 결과에 저장하지 않는다 (PIPA).
  - **코호트 키 산출:** `bias_flags` 주 편향 + 연령대 등으로 `cohort_key` 생성 (예: `fomo_high_age_20s`). 키 분류 규칙은 Jerry 운영 결정(8장).
  - **N<5 규칙:** 집계 시점에 `users_in_cohort < 5`인 코호트는 **행 자체를 생성하지 않는다** (1차 방어). RLS `users_in_cohort >= 5`는 2차 방어선.
  - **upsert:** `ON CONFLICT (cohort_key, cohort_date) DO UPDATE` — pg_cron 재실행 대비 Idempotency (Lock 4).
  - **bias_flag_distribution:** 코호트 구성원의 `bias_flags` 집계 비율을 jsonb로 산출 (AN01 블록2 소스).
- **스케줄: pg_cron 일 1회 (전일 데이터 집계).** 기존 009 `pg_cron_fomo` 패턴 준용 — 신규 마이그레이션(013 또는 011 내 cron 등록)에서 `cron.schedule`. 실행 시각은 KST 새벽(예: UTC 19:00 = KST 04:00) — FOMO 잡과 시간 분리. 정확한 시각은 Jerry 승인.
- **EF 6-Step 적용:** Step 1(service_role 인증·중복 실행 가드) → Step 3 없음(AI 미호출) → Step 5(error_logs 기록) → Step 6(upsert). 모델 호출 없으므로 Lock 5·7 비해당.

### 3-3. `investment_journals` 필드 확장 (012)

| 컬럼 | 타입 | 설명 | nullable |
|------|------|------|----------|
| `reason` | text | 매매 판단 근거 (예: "뉴스에서 본 실적 개선") | YES |
| `source_type` | text | 정보 출처: `'news'` \| `'youtube'` \| `'community'` \| `'self'` \| `'other'` | YES |
| `exit_plan` | text | 출구 계획 (예: "5% 손절, 15% 익절") | YES |

- 3컬럼 전부 nullable — 기존 일지 데이터·기존 클라이언트와 하위 호환.
- `ALTER TABLE ADD COLUMN`만 수행. 기존 RLS·UNIQUE(`user_id, journal_date`)·CHECK 제약 변경 없음.
- **추가 (P-04):** 012에서 `users.coach_persona TEXT` 컬럼도 함께 추가 (nullable, `'lee_kwang_soo'|'park_si_dong'|NULL`). 온보딩 2단계 코치 스타일 선택 저장용 (§5-4). 기존 users RLS(`auth.uid()=id`) 그대로.
- 보조: `user_principle_links` 테이블 (온보딩 2단계 + AR01 저장용) — `user_id` / `principle_id`(FK→partner_principles) / `created_at`, UNIQUE(`user_id, principle_id`), RLS: 본인 SELECT/INSERT만. 011에 함께 정의.

---

## 4. Edge Function 수정 명세

### 4-1. `generate-coaching/index.ts`

**수정 전 (현재) / 수정 후 플로우 비교:**

| 단계 | 현재 (MVP, model:'none') | 수정 후 (T3-B) |
|------|--------------------------|----------------|
| Step 1 | 입력 검증 + Rate Limit (분당 10회) | 변경 없음 |
| Step 2 | maskPII() — 템플릿 대비용 | maskPII()를 **모델 입력 전체**(일지 텍스트 포함)에 적용 (Lock 7) |
| Step 3 | 비용 체크만 (호출 없음, 비용 0) | 비용 체크 → `partner_principles` 조회 → **Claude Haiku 호출** |
| Step 4 | legalPostFilter() 7종 키워드 | 변경 없음 — **AI 응답에 동일 적용**, 위반 시 카드 폐기 + fallback |
| Step 5 | ai_call_logs (`model:'none'`, 토큰 0) | 실제 `model` / `input_tokens` / `output_tokens` / `estimated_cost_usd` 기록 |
| Step 6 | coaching_cards upsert (`source:'template'`) | upsert 동일 (conflict key **`user_id,card_date`** 유지), `source:'ai_generated'` |

**Anthropic API 호출 파라미터:**

```
POST https://api.anthropic.com/v1/messages
헤더: x-api-key: <ANTHROPIC_API_KEY>  (Supabase Secrets에서만 읽음)
      anthropic-version: 2023-06-01

model:      claude-3-5-haiku-20241022   ← API 호출 모델명 고정 (CLAUDE.md 표기는 claude-haiku-4-5)
max_tokens: 200
messages:   [{ role: 'user', content: coachingPrompt }]
```

**프롬프트 구조 (개요):**
- 입력 1: 사용자 당일 일지 요약 — maskPII() 통과본 (ticker는 전달하지 않거나 마스킹 — Lock 7 "종목명+수익률 조합" 금지)
- 입력 2: 사용자 아키타입 + bias_flags
- 입력 3: `partner_principles` 활성 원칙 목록 (`partner_id='jagabang'`)
- 지시: "충돌하는 원칙 1~2개를 찾고, '왜 이것이 당신의 거래에 중요했을까?'를 묻는 코칭을 3문장으로 작성. 매수·매도 권유, 목표가, 수익 보장, 가격 예측 표현 절대 금지."

**LOCK 처리 위치:**
- **LOCK 5 (FALLBACK_MESSAGE):** ① Step 3 진입 전 월 비용 ≥ $5 시 fallback 반환 + `coaching_ai` flag 자동 OFF (기존 코드 유지) ② Claude API 호출 실패/타임아웃 시 fallback 반환 (신규 catch 경로). fallback 문구는 기존 상수 그대로 — 동적 생성 금지.
- **LOCK 6 (LEGAL_FILTER_KEYWORDS 7종):** Step 4 후처리 단계 — Claude 응답 텍스트에 기존 `legalPostFilter()` 적용. 감지 시: 응답 저장 금지 → `error_logs`에 `type:'legal_filter_violation'` 기록 → fallback 메시지로 교체. 클라이언트 필터링 금지 (Edge 전용).
- **환경변수:** `ANTHROPIC_API_KEY` — Supabase Edge Function Secrets 전용. `.env.local`·클라이언트 번들 포함 금지. **현재 미등록 상태 (GAP-1) — Jerry 직접 등록 필요.**

---

## 5. 화면 명세

### 5-1. `J01_JournalCreate.tsx` 수정

- **신규 필드 3종 UI:** 기존 "감정 메모" 섹션 아래에 **"원칙 연결" 접기/펼치기 섹션** 신설 (기본 접힘)
  - `reason` — 자유 텍스트 1줄 입력 ("이번 판단의 근거는?")
  - `source_type` — 5-choice 칩 선택 (뉴스 / 유튜브 / 커뮤니티 / 직접 분석 / 기타)
  - `exit_plan` — 자유 텍스트 1줄 입력 ("출구 계획이 있나요? 예: −5% 손절")
- 3종 전부 optional — 미입력 시 저장 차단 없음, D-Score 산식에 미반영 (LOCK 산식 변경 금지)
- 기존 저장 플로우(UPSERT → calculate-discipline → generate-coaching) 변경 없음. UPSERT payload에 3필드만 추가.

### 5-2. `AN01_Analysis.tsx` (신규 — `App.tsx` InsightsPlaceholder 교체)

| 순서 | 블록 | 데이터 소스 | 표시 조건 |
|------|------|------------|----------|
| 1 | D-Score 30일 트렌드 차트 | `discipline_logs` 최근 30일 SELECT | 기록 1건 이상 |
| 2 | 편향 프로파일 (내 vs 유사군) | 내: `bias_assessments.bias_flags` / 유사군: `behavior_cohorts.bias_flag_distribution` (내 cohort_key, P-02) | 진단 완료 + 유사군 N≥5 시. N<5면 내 프로파일만 표시 |
| 3 | 준거집단 어제 행동 리포트 | `behavior_cohorts` (어제 날짜, 내 cohort_key) | **N≥5 행 존재 시만** |
| 4 | 오늘 변화 요약 | discipline_logs 전일 대비 delta + coaching_cards | 당일 기록 존재 시 |

- **빈 상태 처리:**
  - 블록 3 cohort N<5 (RLS로 행 미반환): "아직 비교할 유사 투자자 데이터가 충분하지 않습니다. 데이터가 모이면 자동으로 표시됩니다."
  - 블록 1 기록 없음: "일지를 작성하면 규율 트렌드가 여기에 쌓입니다." + [일지 쓰기] CTA
- 클라이언트는 SELECT 전용 (Lock 3) — 집계 연산은 DB/EF에서 완료된 값만 표시.

### 5-3. `AR01_Archive.tsx` (신규)

- **리스트 구성:** `partner_principles` 파트너별 → `broadcast_date` 내림차순. 상단 카테고리 필터 칩 3종 (discipline / fomo_response / risk_management)
- **카드 컴포넌트 필드:** `principle_text` / `principle_category` 배지 / `coach_persona` 표시(이광수·박시동) / `broadcast_date` / "이 원칙 저장" 버튼
- "이 원칙 저장" → `user_principle_links` INSERT (클라이언트 직접 — principles 패턴과 동일한 User-owned 쓰기 예외) → "✓ 저장됨" 상태 전환 (P01 추천 원칙과 동일 UX)
- 진입점: 5-Tab 구조 유지를 위해 v1은 P01(원칙 탭) 상단 진입 버튼 또는 풀스크린 라우트로 연결 (탭 6 신설 금지 — IA 변경은 Jerry 결정)

### 5-4. 온보딩 2단계 확장

- **흐름:** `S04/AssessmentResult` (기존, 변경 금지) → **신규 `PrincipleFitScreen`** → 코치 스타일 선택 → Main 진입
- 기존 편향 진단 7문항은 절대 변경 금지 (Schema LOCK v1.0). 2단계는 별도 화면·별도 저장 — `bias_assessments`에 쓰지 않는다.
- **질문 초안 (3~5문항, 5-point 공감도, Jerry 확정 필요):**
  1. "오르는 종목을 따라 사는 것보다, 내가 정한 기준에 맞을 때만 사는 편이 낫다."
  2. "손절 라인은 매수 전에 정해야 하며, 정했으면 지켜야 한다."
  3. "방송·뉴스에서 들은 종목은 최소 하루 검토 후에 행동한다."
  4. "수익이 났을 때 파는 기준도 미리 정해둔다."
  5. "시장이 급락한 날일수록 매매를 줄인다."
- **코치 스타일 선택:** 이광수형 / 박시동형 2-choice 카드.
- **저장 위치 (P-04 — 확정):** `users.coach_persona TEXT` 컬럼을 **012 마이그레이션에 추가** (조회 단순·단일 출처). `user_principle_links` 메타 분산 저장은 채택하지 않음.
- **저장:** 공감도 상위 원칙 → `user_principle_links` 초기 INSERT.

### 5-4a. coach_persona 보이스 정의 (P-03 — generate-coaching 프롬프트 주입용)

> 코칭 카드의 톤·관점 차별화 근거. **콘텐츠(실제 코칭 철학·말투·예시)는 Jerry가 주식아가방 본방 기반으로 검수·확정**(파트너 콘텐츠 귀속 — 사실과 다른 페르소나 묘사 금지). 아래는 채워야 할 필드 구조다.

| 필드 | `lee_kwang_soo` (이광수형) | `park_si_dong` (박시동형) |
|------|---------------------------|--------------------------|
| 강조 원칙 (1줄) | *(Jerry 확정)* | *(Jerry 확정)* |
| 코칭 관점 (무엇을 먼저 짚는가) | *(Jerry 확정)* | *(Jerry 확정)* |
| 말투/톤 | *(Jerry 확정)* | *(Jerry 확정)* |
| 대표 코칭 문장 예시 (1~2개) | *(Jerry 확정)* | *(Jerry 확정)* |

- **프롬프트 주입 방식:** generate-coaching(§4-1)에서 사용자 `users.coach_persona` 조회 → 해당 페르소나의 위 정의를 system/지시 블록에 삽입 → 동일 `partner_principles`라도 페르소나별 톤으로 코칭 생성.
- **LOCK 무관 고정:** 페르소나가 무엇이든 Lock 6 법적 필터(매수·매도·목표가·수익보장 등)와 면책 문구는 동일 적용 — 페르소나는 톤만 바꾸고 컴플라이언스는 바꾸지 않는다.

---

## 6. LOCK 준수 체크리스트

| Lock | 항목 | 본 PRD 적용 위치 |
|------|------|------------------|
| Lock 1 | 클라이언트 AI 직접 호출 금지 | Claude 호출은 generate-coaching EF 내부에만 존재. 클라이언트는 EF 호출 + SELECT 전용. `grep -r "anthropic" ./src` 0건 유지 |
| Lock 2 | 리스크 기능 기본 OFF | `coaching_ai` flag 현재 false — T3 Gate 통과 + Jerry 승인 후 SQL로만 true 전환 |
| Lock 3 | coaching_cards 클라이언트 INSERT 금지 | 변경 없음 — EF service_role upsert 유지. partner_principles/behavior_cohorts 쓰기도 service_role 전용 |
| Lock 4 | Idempotency | coaching_cards `UNIQUE(user_id, card_date)` 유지. behavior_cohorts `UNIQUE(cohort_key, cohort_date)` 신규 적용 |
| Lock 5 | COACHING_FALLBACK_MESSAGE | EF Step 3 비용 차단 + Claude 호출 실패 catch — 두 경로 모두 고정 fallback 반환 (4-1 참조) |
| Lock 6 | LEGAL_FILTER_KEYWORDS 7종 | EF Step 4 후처리 — AI 응답에 legalPostFilter() 적용, 위반 시 카드 폐기 + error_logs (4-1 참조) |
| Lock 7 | PII 외부 모델 반출 금지 | 모델 입력 전 maskPII() 강제. ticker+수익률 조합 미전달 (4-1 프롬프트 구조 참조) |
| PIPA | behavior_cohorts 익명화 | 집계값만 저장 + 생성 시 N≥5 미달 행 미생성 + RLS `users_in_cohort >= 5` 2차 방어 (3-2 참조) |
| Lock 6 (면책) | 코칭 카드 면책 문구 | **AI 생성 코칭 카드 렌더 시 의무 면책 문구 포함 강제** (기존 템플릿 카드와 동일). `coaching_cards`에 disclaimer 필드 유지 — 삭제·축약·위치 변경 금지 (CLAUDE.md Lock 6 원문) |
| 귀속 (P-05) | 파트너 콘텐츠 귀속 표기 | 코칭이 `partner_principles` 원칙을 인용·반영할 때 카드에 **"참고: 주식아가방 원칙" 등 출처 귀속 표기**. 귀속 문구 최종본은 Jerry가 파트너와 합의 (8장). INVIT 정체성·면책은 불변, 귀속은 부가 표기 |

> 본 PRD는 bias_assessments 스키마 / FOMO_THRESHOLDS / discipline 가중치 / 법적 면책 문구에 대한 어떠한 변경도 포함하지 않는다. 코칭 카드 면책 문구는 추가가 아니라 **기존 강제 규칙의 재확인**이다.

---

## 7. 비기능 요구사항

- **Claude Haiku 예상 비용 (일지 100건/일 기준 추정):**
  - 호출당 입력 ~1,500 tokens (일지 요약 + 원칙 목록 + 지시) / 출력 ~200 tokens (max_tokens 제한)
  - claude-3-5-haiku 단가 기준(입력 $0.80/M, 출력 $4.00/M): 호출당 ≈ $0.002 → **일 100건 ≈ $0.20/일, 월 ≈ $6/월**
  - Lock 5 월 $5 차단선과 충돌 가능 — 100건/일 도달 전에 차단선 상향 여부 Jerry 결정 필요 (8장). 초기(베타 ~10건/일)는 월 $0.6 수준으로 여유.
- **응답 타임아웃:** Claude 호출에 10s 타임아웃 (AbortController) — 초과 시 Lock 5 fallback 경로. EF 전체 응답 목표 < 15s.
- **Feature Flag (P-06 — v1 단일 flag 확정):** `coaching_ai` (현재 false) 단일 flag로 운영. **v1은 파트너가 주식아가방 1호뿐이므로 별도 `partner_mode` flag 미신설** — AI 코칭 = 파트너 코칭이 1:1 대응. `coaching_ai`는 T3 Gate DoD 전체 통과 + Jerry 승인 후 SQL 직접 UPDATE로만 true 전환. EF는 flag false 시 기존 템플릿 경로로 동작 (점진 전환·즉시 롤백 가능 구조). 파트너 2호 입주 시점(T4)에 `partner_mode`/파트너별 flag 분리 재검토.
- **장애 격리:** Claude 장애 시에도 코칭 카드는 fallback으로 항상 생성 — 코어 루프(일지→D-Score) 무영향.

---

## 7-A. T3 Gate DoD (P-07 — SPRINT_PLAN [C] 동기화)

> 정본은 [SPRINT_PLAN.md](./SPRINT_PLAN.md) [C] "T3 Gate DoD". 본 절은 PRD 단독 검토용 요약 복제 — 불일치 시 SPRINT_PLAN 우선.

- [ ] 일지 작성 → Claude Haiku 코칭 카드 생성 E2E 통과
- [ ] `partner_principles` 시드 5종 클라우드 적용 확인
- [ ] LOCK 5/6 필터 동작 확인 (키워드 감지 시 카드 폐기 + fallback)
- [ ] AN01 분석탭에서 cohort 카드 표시 (N≥5 필터 동작 확인)
- [ ] PIPA 준수: behavior_cohorts 개인 단위 데이터 노출 없음
- [ ] `feature_flags.coaching_ai`: Gate 통과 + Jerry 승인 후에만 true 전환 (Lock 2 — 기본 OFF 유지)

---

## 8. Jerry 직접 처리 항목

| # | 항목 | 시점 | 비고 |
|---|------|------|------|
| 1 | **`ANTHROPIC_API_KEY` Supabase Edge Function Secrets 등록** | T3 착수 전 (LOI 직후) | **GAP-1: 현재 `.env.local`에도 미등록 상태 실측 확인 (2026-06-10).** SSOT 0-4-3의 "등록 완료" 기재 정정 필요 |
| 2 | RevenueCat 상품 ID 설정 | T1-5 | monthly ₩29,800 / yearly ₩298,000 + test store 키 → 정식 키 교체 |
| 3 | behavior_cohorts 운영 기준 확정 (N ≥ 몇 명?) | T3-A 전 | 본 PRD 기본값 N≥5. 상향 시 RLS 정책 값만 변경 |
| 4 | partner_principles 시드 5종 콘텐츠 검수 | T3-A | 본방 기반 원칙 카드 — 수동 입력 (Review Layer = 사람 검수) |
| 4b | **coach_persona 코칭 보이스 정의 (이광수형/박시동형)** | T3-B 전 | §5-4a 표의 4개 필드 확정 — 실제 본방 기반, 사실과 다른 묘사 금지 (P-03) |
| 4c | 파트너 콘텐츠 귀속 문구 합의 ("참고: 주식아가방 원칙" 등) | T3-B 전 | 파트너와 표기 방식 합의 (P-05) |
| 5 | Lock 5 비용 차단선($5/월) 상향 여부 | T3 운영 후 | 일지 100건/일 도달 시 월 ~$6 추정으로 차단선 초과 (7장 참조) |
| 6 | AR01 진입점 IA 결정 (P01 내 버튼 vs 별도 라우트) | T3-F | 5-Tab 구조 변경은 Jerry 승인 사항 |
