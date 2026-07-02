# INVIT 0617 업그레이드 — 자율 작업 핸드오프 (Jerry 처리 항목)

> 작성: Claude Code · 2026-06-17 · 기준 문서: Notion "INVIT 독자 런칭 업그레이드 마스터플랜 (0617 확정)"
>
> 이 문서는 **오늘 자율로 구현한 코드**와 **Jerry가 직접 처리해야 할 외부 작업**을 정리한다.
> 자율 작업 범위 = 외부 계정/키/배포가 필요 없는 코드·파일 작성까지. 클라우드 적용·빌드·키 등록은 Jerry 몫.

---

## 0. ⚠️ 가장 먼저 — 적용 순서

✅ **마이그레이션 011~018 invit-staging(txomdwlottxbfbdixcye) 모두 적용 완료**(2026-06-18, MCP). 신규 일지 UX·종목검색·pgvector·RAG 함수 DB 준비됨.

✅ **sync-stocks 배포 + 전종목 2,721개 적재 완료** — 016 cron 주1회 자동 갱신.

남은 순서: ① ANTHROPIC_API_KEY 등록 + `coaching_ai` 플래그 ON → ② generate-coaching EF 재배포 → ③ EAS 빌드/E2E.

---

## 1. 오늘 자율로 완료한 작업 (코드/파일)

| 영역 | 파일 | 내용 |
|------|------|------|
| 마이그레이션 | `supabase/migrations/011_extend_journals_and_stocks.sql` | `investment_journals` 확장 컬럼(has_trade·impulse_*·trade_reason_tags·principle_compliance·entry_duration_seconds) + `stocks` 종목 캐시 테이블 + RLS |
| 마이그레이션 | `012_create_principles_master.sql` | 글로벌 원칙 마스터 DB(4-Tier, Admin-managed, SELECT 전용) |
| 마이그레이션 | `013_create_briefings_and_sources.sql` | `daily_briefings` + `content_sources` (시황 파이프라인용) |
| 마이그레이션 | **`017_pgvector_principles_embedding.sql`** (신규) | pgvector 확장 + `principles_master.embedding vector(1536)` + HNSW 코사인 인덱스 + `embedding_model`, `embedded_at` 컬럼. invit-staging 적용 완료 (2026-06-18). |
| 시드 | `014_seed_principles_master.sql` | 글로벌 대가 + INVIT 독자 원칙 **36개** (법적 필터 안전) |
| 시드 | `015_seed_stocks.sql` | 주요 KRX 종목 + 대표 ETF **60개** (검색 starter) |
| 타입 | `src/types/database.ts` | Stock·PrincipleMaster·DailyBriefing·ContentSource 타입 + InvestmentJournal 확장 + TradeReasonTag·PrincipleCompliance enum |
| 유틸 | `src/lib/koreanSearch.ts` | 한글 초성/부분일치 검색 (의존성 0) — '삼전'→삼성전자 |
| 상수 | `src/constants/journal.ts` | 매매 이유 태그·원칙 준수 옵션 |
| 컴포넌트 | `src/components/StockSearchInput.tsx` | 종목 검색 자동완성 (모듈 캐시 + 초성 검색 + 직접입력 폴백) |
| 화면 | `src/screens/J01_JournalCreate.tsx` | 종목 검색 연동 + 무거래일 충동 신호 + 매매 이유 칩 + 원칙 준수 O/△/X + 작성시간 측정 |
| 화면 | **`src/screens/J02_JournalView.tsx`** (업데이트) | 신규 필드 표시: 매매 이유 태그 칩·원칙 준수 O/△/X 배지·충동 신호 카드(무거래일) |
| 화면 | **`src/screens/J02_JournalHistory.tsx`** (업데이트) | 리스트 카드에 원칙 준수 O/△/X 컬러 도트 + 충동신호 ✓ 표시 |
| 화면 | **`src/screens/H01_Home.tsx`** (업데이트) | 오늘의 시황 브리핑 카드 추가 (`daily_briefings` 연동, Gemini 파이프라인 활성화 후 표시) |
| Edge Function | `supabase/functions/generate-coaching/index.ts` | **게이트형 Claude 연동**(Pillar 4 Stage 1). 키+플래그 충족 시 Claude, 아니면 기존 템플릿 폴백 |
| Edge Function | **`supabase/functions/generate-embeddings/index.ts`** (신규) | principles_master 배치 임베딩 생성 EF (OpenAI text-embedding-3-small). OPENAI_API_KEY Secret 등록 후 `supabase functions deploy generate-embeddings --no-verify-jwt` 배포. 반복 호출로 전체 처리. |
| 화면 | **`src/screens/P01_PrincipleManage.tsx`** (업데이트) | "글로벌 대가 원칙 탐색" 섹션 추가 — principles_master 브라우저(전체/글로벌/한국/INVIT 탭 필터, 편향 태그, 바로 추가) |
| DB 함수 | **`018_rag_similarity_function.sql`** (신규) | `find_similar_principles(query_embedding, match_count, filter_archetype)` SQL 함수 — pgvector 코사인 유사도 검색. Phase 1 고도화용. |
| 마이그레이션 | **`019_fix_principles_master_schema.sql`** (신규) | `principles_master.archetype_tags text[]` 컬럼 + GIN 인덱스 추가. `get_principles_by_archetype()` SQL 함수(임베딩 없는 키워드 RAG). invit-staging 적용 완료. |
| 마이그레이션 | **`021_fix_archetype_tags_seed_korean.sql`** (신규) | 34개 원칙 전체 archetype_tags 시드 완료 (한국어 bias_tag 기반 — panic_reactor 22개, overconfident_holder 23개, theme_chaser 18개 등). |
| SSOT | `CLAUDE.md` | AI 모델 표기 정정(retired `claude-3-5-haiku-20241022` → `claude-haiku-4-5` / 페르소나 `claude-sonnet-4-6`) |

검증: `npx tsc --noEmit` 통과(EXIT 0). 앱 코드 타입 에러 0. (Deno EF는 tsconfig 제외 — 배포 시 Supabase가 검증)

**안전성:** `generate-coaching`은 ANTHROPIC_API_KEY와 `coaching_ai` 플래그가 **둘 다** 충족될 때만 Claude를 호출한다. 현재 둘 다 미설정이므로 EF를 재배포해도 **현 동작(템플릿)과 100% 동일**하다. Jerry가 활성화하기 전까지 비용·동작 변화 없음.

---

## 2. Jerry 처리 항목 (우선순위)

### 🔴 P0 — 런칭 블로커 / 신규 기능 활성화

- [x] **마이그레이션 011~016 invit-staging 적용 완료** (2026-06-17, MCP) — stocks 60·principles_master 34·신규 일지 컬럼 6·stock-sync cron 등록 확인. ⚠️ **주의: 최초 실수로 OMYQT 프로덕션(omyqtd-prod)에 012~014가 잘못 적용됨 → 아래 OMYQT 정리 필요.**
- [x] **OMYQT 프로덕션 정리 완료** — 잘못 생성됐던 3개 테이블(principles_master·daily_briefings·content_sources)이 omyqtd-prod에서 제거됨(2026-06-18 확인). 🚫 **그 DROP SQL은 더 이상 실행하지 말 것** — invit-staging에도 같은 이름 테이블이 정상 존재하므로 어느 DB에서 실행해도 사고. (실제로 한 번 invit에 오실행되어 복구함.)
- [x] **sync-stocks EF 배포 + 전종목 적재 완료** (2026-06-18) — `stocks` 2,721개(KOSPI 833·KOSDAQ 1,774·KONEX 106·ETF 8). 데이터 소스 = **금융위원회_KRX상장종목정보 `GetKrxListedInfoService/getItemInfo`**(KRX_API_KEY 승인 API). 016 cron 주1회 자동 갱신. 인증: service_role JWT role 클레임 / 선택적 SYNC_SECRET.
  - 미해결 메모: **check-fomo는 `getStockPriceInfo`(주식시세정보)** 사용 — 별도 API라 아직 미승인(403). FOMO 실데이터 켜려면 data.go.kr에서 '금융위원회_주식시세정보' 추가 활용신청 필요.
  - ETF 전체 동기화는 후속(getItemInfo는 주식만 반환 — 대표 ETF 8종 시드 유지).
- [ ] **ANTHROPIC_API_KEY 등록** (GAP-1) — `eas env`/Supabase Secrets + 로컬 `.env.local`. Claude 코칭(Pillar 4)의 선행 조건.
- [ ] **`feature_flags.coaching_ai = true`** SQL 업데이트 (키 등록 후) — Claude 코칭 경로 활성화. `update feature_flags set enabled=true where key='coaching_ai';`
- [ ] **generate-coaching EF 재배포** — `supabase functions deploy generate-coaching` (게이트형 Claude 코드 반영).
- [ ] **RevenueCat 정식 스토어 키(goog_)** 발급·교체 — 구독 활성화.
- [ ] **EAS Android Build** → 실기기 설치 → **전체 E2E**(온보딩→일지(종목검색)→규율→코칭→FOMO→구독) → **Google Play Internal Test** 등록.
- [x] **포그라운드 알림 핸들러** — `App.tsx` 246~263줄에 `addNotificationReceivedListener` + `addNotificationResponseReceivedListener` 이미 완성(자동 배너 표시 + 탭 시 H01으로 포커스 전환).

### 🟡 P1 — 품질/데이터 보강 (런칭 직후)

- [ ] **비용 단가 검증** — `generate-coaching/index.ts`의 `HAIKU_INPUT_USD_PER_MTOK=1.0`, `HAIKU_OUTPUT_USD_PER_MTOK=5.0`가 현행 Anthropic 가격과 일치하는지 확인(2026-06 기준 claude-haiku-4-5 = $1/$5 per MTok로 작성됨). 변경 시 상수만 수정.
- [x] **KRX 전종목 동기화 완료** — sync-stocks EF + 016 cron으로 2,721개(KOSPI·KOSDAQ·KONEX·ETF) 적재. 주1회 자동 갱신. ⚠️ check-fomo는 별도 API(`getStockPriceInfo`) — data.go.kr '금융위원회_주식시세정보' 추가 활용신청 필요.
- [ ] **이광수·박시동 원칙 큐레이션** — `principles_master`에 `source_tier='kr'`로 실제 공개 콘텐츠 원칙 추가(편집팀). 현 seed는 글로벌+INVIT 독자 원칙만(특정인 발언 미귀속 — 오귀속 방지).
- [x] **pgvector 인프라** — `017_pgvector_principles_embedding.sql` 적용 완료(2026-06-18). `principles_master.embedding vector(1536)` + HNSW 코사인 인덱스 준비됨. 남은 것: **임베딩 생성 파이프라인** — `generate-embeddings` EF를 만들어 OpenAI text-embedding-3-small로 배치 생성 필요(OPENAI_API_KEY 등록 전제). Phase 1.

### 🟢 P2 — 외부 시스템 (코드화 안 됨)

- [ ] **시황 브리핑 파이프라인 (Pillar 3)** — Google AI Studio + Apps Script + Sheets로 '12시에 만나요' 자동 브리핑 구축 → `daily_briefings` INSERT. DB 테이블은 준비됨(`013`). 앱 측 브리핑 표시 UI는 후속.
- [ ] **PostHog**(리텐션 계측), **집단 감정 지수/준거집단**(Pillar 5), **원칙 게이트**(Pillar 6), **성장 카드**(Pillar 7) — Phase 1~2, 미착수.

---

## 3. 적용 후 검증 (E2E 체크)

1. **종목 검색**: 일지 작성 → 매수 선택 → 검색창에 `삼전`/`005930` 입력 → 삼성전자 리스트업 → 선택 → 저장.
2. **무거래일 일지**: 매매 없음 선택 → 충동 신호(사고/팔고 싶었던 종목) 검색·선택 → 저장 → `investment_journals.impulse_buy_ticker` 확인.
3. **매매 이유/원칙 준수**: 매수 일지에서 이유 칩 다중선택 + O/△/X → 저장 → `trade_reason_tags`, `principle_compliance` 확인.
4. **Claude 코칭 + RAG**(키+플래그 ON 후): 일지 저장 → 코칭 카드가 개인화 문구로 표시 + 관련 대가 원칙 자연스럽게 녹여있는지 확인 → `coaching_cards.source='ai_generated'`, `ai_call_logs` 기록 확인.
5. **폴백 안전성**(키 OFF 상태): 코칭이 기존 템플릿으로 정상 동작하는지(회귀 없음) 확인.
6. **법적 필터**: 코칭에 금지어 미포함 + 면책 문구 표시 확인.
7. **글로벌 원칙 탐색(P01)**: 원칙 관리 → "글로벌 대가 원칙 탐색" 펼침 → 탭 필터 전환 → "+ 추가" 버튼 → 내 원칙 목록에 추가 확인.
8. **일지 상세(J02_JournalView)**: 일지 작성(매매이유 + O/△/X) → 조회 화면에서 태그 칩·원칙 준수 배지 표시 확인.

---

## 4. 미완료/이관 (자율 범위 밖)

- **클라우드 반영 필요(Jerry):** generate-coaching EF 재배포(Claude 게이트 코드). 마이그레이션 011~018 모두 invit-staging 적용 완료.
- **이광수·박시동 실제 원칙 큐레이션**, **Gemini 시황 파이프라인**, **집단지수·준거집단·원칙게이트·성장카드** = 후속 Phase 1~2.
- **pgvector 임베딩 파이프라인** — `generate-embeddings` EF 작성 완료. OPENAI_API_KEY Supabase Secret 등록 후 배포·실행 필요(`supabase functions deploy generate-embeddings --no-verify-jwt`). 배치 50개씩 반복 호출.
- **generate-coaching RAG 통합 완료 (키워드 방식)** — `get_principles_by_archetype()` 함수로 관련 원칙 Top-3를 Claude 컨텍스트에 자동 주입. ANTHROPIC_API_KEY 등록 즉시 활성. 임베딩 RAG(벡터 유사도)는 Phase 1에서 `find_similar_principles()`로 고도화.
- **일일 시황 카드** — H01 브리핑 카드 UI 완성됨. Gemini 파이프라인이 `daily_briefings` INSERT 시작하면 즉시 표시됨(추가 코드 불요).

---

## 5. 롤백 노트

- 새 마이그레이션은 전부 **additive**(ADD COLUMN / CREATE TABLE). 기존 스키마·LOCK 무변경. 문제 시 신규 테이블 drop으로 격리 가능.
- 코칭 Claude 경로는 `coaching_ai` 플래그 OFF로 즉시 템플릿 회귀(코드 롤백 불요).
