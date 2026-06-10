# INVIT — T1·T3 Sprint Plan

> 작성: 2026-06-10 | 작성자: Claude Code | 근거: Notion SSOT 6개 문서 정독 + 코드베이스 직접 대조
> 참조 문서: Main Dashboard / 향후 작업 방향성 확정(0610) / CTO 보강안 T1·T2·T3 / UX v2.0 / AI 아키텍처 v2.0 / LOCK 통합본
> 이 문서는 계획 문서다. 구현 착수는 별도 세션에서 진행한다.

---

## [A] 현황 정합성 요약 (Ground Truth, 2026-06-10 코드 실측)

### A-1. 정합성 체크 포인트

| 항목 | SSOT 기준 | 실제 코드 (2026-06-10 확인) | 일치 여부 |
|------|-----------|------------------------------|---------|
| generate-coaching 모델 | `model:'none'` (DB 조회) | `model: 'none'` — `supabase/functions/generate-coaching/index.ts:237`, archetype_templates 조회 방식, 외부 AI API 호출 코드 없음 | ✅ 일치 |
| ANTHROPIC_API_KEY | "준비됨(.env.local 등록), 미연결" | ⚠️ **`.env.local`에 `ANTHROPIC_API_KEY` 활성 키 없음.** 주석으로 `CLAUDE_API_KEY`(EF Secrets 전용) 언급만 존재. "코드에서 미참조"는 일치 | ❌ **GAP-1** |
| AI 모델 표기 | claude-haiku-4-5 (CLAUDE.md 참조명) vs claude-3-5-haiku-20241022 (API 호출명) | 동일 모델의 다른 표기 — claude-haiku-4-5는 참조 이름, claude-3-5-haiku-20241022는 구체적 버전 ID (정상) | ✅ 일치 |
| 마이그레이션 최고 버전 | 010 (클라우드 적용 완료, 2026-06-08 실측) | 로컬 파일 `001_create_users.sql` ~ `010_add_push_token.sql` 전체 존재 | ✅ 일치 |
| J01 필드 | 기존 필드만 (확장 전) | `emotion_checkin` / `trade_action` / `ticker` / `trade_rationale` / `bias_check` / `emotion_memo` / `principle_checks` — `reason`/`source_type`/`exit_plan` 없음 | ✅ 일치 |

### A-2. GAP 목록

| ID | 내용 | 영향 | 처리 |
|----|------|------|------|
| GAP-1 | `ANTHROPIC_API_KEY`가 `.env.local`에 미등록 (SSOT 0-4-3은 "2026-04-04 등록 완료"로 기재) | T3-B Claude 연동 테스트 시 블로커. T1에는 영향 없음 | Jerry 직접: Supabase Edge Function Secrets에 등록 (T3 착수 전). Notion SSOT 0-4-3 기재 정정 권장 |

### A-3. 추가 확인 사항 (SSOT 기재와 일치하거나 SSOT보다 앞선 항목)

- **check-fomo EF는 scaffold가 아니라 본구현 완료** — 공공데이터포털 금융위원회 주식시세정보 API 연동, `KRX_API_KEY`는 Supabase Secret에서만 읽음 (Lock 1 준수). surge_standard / plunge_standard 2종만 구현 (elevated 금지 준수)
- coaching_cards의 Idempotency 키는 **`UNIQUE(user_id, card_date)`** (`006` 마이그레이션 `unique_coaching_per_day`) — EF upsert `onConflict: 'user_id,card_date'`와 일치
- feature_flags 실측 (SSOT 2026-06-08 기록 기준): `fomo_alert=true`, `subscription=true`, `coaching_ai=false`, `retrigger_assessment=false`
- 5-Tab 네비게이션 구현 완료. 분석 탭은 `InsightsPlaceholder` (`App.tsx:131`) — AN01 미구현 (T3-E 대상)
- RevenueCat SDK 초기화 코드 존재 (`configureRevenueCat()`, `App.tsx:196`). `EXPO_PUBLIC_REVENUECAT_API_KEY`는 test store 키 (정식 스토어 키 아님)
- `src/` 내 `openai` / `anthropic` 참조 0건 — Lock 1 준수 확인
- 화면 11종 존재: S01~S04(Auth) + 온보딩 2종 + H01 / J01 / J02(History·View) / P01 / ST01 / Subscription

---

## [B] T1 코어 런칭 Sprint — 체크리스트

**목표:** 2주 내 Google Play Internal Test Track 등록 완료
**추가 비용:** ≈ ₩0 (기존 인프라). 인프라(마이그레이션 001~010, pg_cron, push_token, feature_flags)는 전부 준비 완료 — 빌드부터 시작 가능.

### T1-1. CLAUDE.md 모델 표기 수정 [1일]

- [ ] CLAUDE.md의 모델 표기를 `"claude-haiku-4-5 (Phase 2 예정, 현재 MVP는 DB archetype_templates 조회 — model:'none')"`로 수정
  - 수정 위치: Executive Summary 1번 항목 (현재 오기재: `GPT-4o-mini + text-embedding-3-small`) + Architecture 다이어그램 (현재 오기재: `GPT-4o-mini → 법적필터`)
  - 주의: API 호출명 `claude-3-5-haiku-20241022` (구체적 버전 ID) ≠ 문서 참조명 `claude-haiku-4-5` (간단한 이름)은 동일 모델이므로 문제 없음
- [ ] Codex로 코드상 `model:'none'` 표기와 일치 여부 교차 검증
- [ ] Jerry 승인 후 커밋 (SSOT 0-8-1 완료 처리)

### T1-2. EAS Android Build [2~3일]

- [ ] `eas build --profile development --platform android` 실행
  - 선행: EAS 프로젝트 초기화 여부 확인 (`eas.json` / Expo 계정 연결 — 미완 시 Jerry 계정으로 `eas init`)
- [ ] APK 생성 확인 (크기 < 50MB)
- [ ] 빌드 로그에 에러 없음

### T1-3. 실기기 E2E 테스트 [3~4일] — Android 12 이상

- [ ] SignUp → 이메일 인증 → 로그인
- [ ] OnBoarding 7문항 → 아키타입 판정 + 면책 문구 표시 (Q4 3-point / Q6 역방향 채점 확인)
- [ ] Home DisciplineScoreBadge 표시
- [ ] J01 작성 → calculate-discipline EF → discipline_logs upsert
- [ ] generate-coaching EF → coaching_cards 생성 → H01 표시 (disclaimer 포함)
- [ ] J02 히스토리 리스트 표시
- [ ] P01 원칙 추가/삭제 + 아키타입 추천 원칙 동작
- [ ] ST01 로그아웃 정상
- [ ] 포그라운드 알림 핸들러 연결 확인 (SSOT 미완료 항목 — 미연결 시 T1 범위에서 코드 보완)
- [ ] Codex 보안 교차 검증: `.env` gitignore 등록 / anon key만 사용 / EF 게이트 경유 / Lock 1~7 준수

### T1-4. Google Play Internal Test Track [2~3일]

- [ ] aab 빌드 생성 (`eas build --profile production --platform android` 또는 전용 프로파일)
- [ ] Google Play Console 업로드 (선행: Jerry — Google Play 개발자 계정 + 앱 등록)
- [ ] 내부 테스터 3명 초대 링크 생성
- [ ] 설치 후 실기기 재검증 (72시간 승인 대기 감안)

### T1-5. RevenueCat 상품 설정 [Jerry 직접, 1일]

- [ ] `invit_premium_monthly` (₩29,800) 생성
- [ ] `invit_premium_yearly` (₩298,000) 생성
- [ ] Google Play 상품 ID 연동 확인
- [ ] `EXPO_PUBLIC_REVENUECAT_API_KEY` test store 키 → 정식 키 교체 시점 결정

### T1 Gate DoD

- [ ] Android 빌드가 Google Play Internal Test Track에 올라가 있음
- [ ] 테스터 최소 1명이 설치 후 E2E 전체 플로우 통과 확인
- [ ] CLAUDE.md 모델 표기 수정 커밋 완료

### T1 첫 번째 블로커 (착수 전 Jerry 확인 필요)

1. **EAS/Expo 계정 + Google Play 개발자 계정** — T1-2/T1-4의 외부 선행 조건 (코드로 대체 불가)
2. 포그라운드 알림 핸들러 — SSOT상 "코드 미작성". T1-3에서 발견 시 보완 (소규모)

---

## [C] T3 파트너 레이어 Sprint — 체크리스트

> **착수 조건 (절대): Jerry의 LOI(주식아가방 계약 의향 확인) 신호 수신 후에만 착수.**
> 이 문서는 계획만 확정한다. LOI 전 구현 착수 금지 (매몰비용 방지 — CTO 판단 1).

**목표:** 주식아가방 파트너 코칭 연동 v1 배포
**선행 (LOI 후 즉시, Jerry 직접):** `ANTHROPIC_API_KEY` Supabase Edge Function Secrets 등록 (**GAP-1 — 현재 미등록**)

### T3-A. 마이그레이션 011 설계 및 적용 [3일]

- [ ] aggregate-cohorts EF 구현 + pg_cron 일간 집계 마이그레이션 (012)
      (소스: discipline_logs + bias_assessments / N<5 미생성 / cohort_stats upsert)
- [ ] `partner_principles` 테이블 SQL 작성 (uuid PK — 기존 001~010 컨벤션 준수)
- [ ] `behavior_cohorts` 테이블 SQL 작성 (PIPA: `users_in_cohort >= 5` RLS 필터)
- [ ] RLS 정책: `ENABLE ROW LEVEL SECURITY` 선행 → read는 인증 유저 전체, write는 service_role 전용
- [ ] 초기 시드 데이터 5종 (주식아가방 원칙) 작성 — Jerry 검수 후 확정
- [ ] `npx supabase db push` → 클라우드 적용 확인

### T3-B. generate-coaching EF 수정 [3~4일]

- [ ] `partner_principles` 조회 로직 추가 (`partner_id='jagabang'`, `is_active=true`)
- [ ] Anthropic API 호출 코드 연결 — 모델: `claude-3-5-haiku-20241022` (6-Step 파이프라인 Step 3에 삽입)
- [ ] LOCK 5 준수: 비용 초과/응답 실패 시 `FALLBACK_MESSAGE` 고정 반환 (기존 코드 유지)
- [ ] LOCK 6 준수: `LEGAL_FILTER_KEYWORDS` 7종 후처리 필터 — AI 응답에도 기존 `legalPostFilter()` 적용, 위반 시 카드 폐기 + error_logs 기록
- [ ] `ai_call_logs`에 실제 토큰/비용 기록 (`model`, `input_tokens`, `output_tokens`, `estimated_cost_usd`)
- [ ] upsert conflict key `user_id,card_date` 유지, `source: 'ai_generated'`로 구분
- [ ] ANTHROPIC_API_KEY Supabase Secrets 등록 (Jerry 직접 — GAP-1)
- [ ] E2E 테스트: 일지 작성 → Claude 코칭 카드 생성 확인

### T3-C. J01 필드 확장 [1일]

- [ ] 마이그레이션 012: `investment_journals`에 `reason` / `source_type` / `exit_plan` 컬럼 추가 (전부 nullable)
- [ ] `J01_JournalCreate.tsx` 필드 추가 (optional, "원칙 연결" 접기/펼치기 섹션)
- [ ] calculate-discipline EF가 신규 필드 추가 후에도 정상 동작 확인 (LOCK 산식 40/40/20 변경 금지)

### T3-D. 온보딩 2단계 확장 [2일]

- [ ] 기존 7문항 LOCK 유지 (절대 변경 금지 — bias_assessments Schema LOCK v1.0)
- [ ] AssessmentResult 화면 이후 2단계 추가 (원칙 적합도 3~5문항)
- [ ] `user_principle_links` 테이블에 초기 INSERT (011 또는 012에 테이블 정의 포함)
- [ ] 코치 스타일 선택 (이광수형 / 박시동형) 저장

### T3-E. AN01 분석탭 구현 [3~4일]

- [ ] `AN01_Analysis.tsx` 신규 생성 — `App.tsx:131` `InsightsPlaceholder` 교체
- [ ] 블록 1: D-Score 30일 트렌드 차트 (discipline_logs)
- [ ] 블록 2: 편향 프로파일 (내 bias_flags vs 유사군)
- [ ] 블록 3: 준거집단 어제 행동 리포트 (behavior_cohorts, **N≥5만 표시**)
- [ ] 블록 4: 오늘 변화 요약
- [ ] 분석 탭 5-Tab 네비게이션 연결 (Placeholder → 실구현)

### T3-F. 원칙 카드 아카이브 탭 [2일]

- [ ] `AR01_Archive.tsx` 신규 생성
- [ ] partner_principles 날짜순 표시
- [ ] 카테고리 필터 (discipline / fomo_response / risk_management)
- [ ] "이 원칙 저장" → user_principle_links INSERT

### T3 Gate DoD

- [ ] 일지 작성 → Claude Haiku 코칭 카드 생성 E2E 통과
- [ ] partner_principles 시드 5종 클라우드 적용 확인
- [ ] LOCK 5/6 필터 동작 확인 (키워드 감지 시 카드 폐기 + fallback)
- [ ] AN01 분석탭에서 cohort 카드 표시 (N≥5 필터 동작 확인)
- [ ] PIPA 준수: behavior_cohorts 원본(개인 단위 데이터) 노출 없음
- [ ] feature_flags `coaching_ai`: Gate 통과 + Jerry 승인 후에만 true 전환 (Lock 2 — 기본 OFF 유지)

---

## 부록: 상세 기능 명세

T3 각 항목의 DB 스키마 / EF 수정 스펙 / 화면 명세는 [PRD_partner_layer.md](./PRD_partner_layer.md) 참조.
