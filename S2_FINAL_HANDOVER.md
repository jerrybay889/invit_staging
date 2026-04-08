# S2 Sprint 최종 인수인계서
**작성일:** 2026-04-08 | **상태:** 코드 완성 100%, 인프라 설정 대기  
**이전 스레드 커밋:** `a010c2d` | **다음 스레드 시작점:** Supabase 마이그레이션

---

## 🎯 Executive Summary

### ✅ 완료된 작업 (3개 스레드)
| 스레드 | 주요 산출물 | 커밋 |
|--------|-----------|------|
| **S0~S1** | SafeAreaView 버그 해결 + 일지/규율/온보딩 | `4bc44eb` |
| **S2-1** | FOMO 경보 + RevenueCat 구독 + Expo Push (코드) | `ccb8cc4` |
| **S2-2** | HANDOVER.md + EXPO_GO_E2E.md (문서) | `a010c2d` |

### 🚀 S2 Sprint 3단계 상태
```
Phase 1 (FOMO 경보)     ✅ 코드 100% | ⏳ 인프라 미적용
Phase 2 (RevenueCat)    ✅ 코드 100% | ⏳ 서비스 미연동
Phase 3 (Expo Push)     ✅ 코드 100% | ⏳ 자격증명 미설정
```

### ⏭️ 신규 스레드 첫 번째 작업
1. **Supabase 마이그레이션 009/010 적용** (15분)
2. **RevenueCat 대시보드 설정** (20분)
3. **Expo 자격증명 확인** (10분)
4. **feature_flags 수동 활성화** (5분)
5. **Expo Go E2E 테스트** (20분)

**예상 소요시간:** ~1시간 (모든 설정 완료 후 E2E)

---

## 📋 신규 스레드 로드할 문서

### 1. `HANDOVER.md` (376줄)
**내용:** 코드 완료 체크리스트 + 인프라 설정 상세

**핵심 섹션:**
- ✅ Phase 1/2/3 코드 완료 상태 (파일별 구현 내용)
- ⏳ Supabase 마이그레이션 009/010 SQL (복사-붙여넣기 가능)
- 📋 RevenueCat 대시보드 체크리스트 (Entitlement/Product/Offering)
- 📋 Expo 자격증명 체크리스트 (APNs/FCM)
- 📋 feature_flags 수동 활성화 SQL
- 🧪 Phase 1/2/3 실기기 테스트 플로우
- 🔍 예상 이슈 및 대응책 (7가지)

**사용 시점:** Supabase 마이그레이션, 서비스 연동, 테스트 수행 시 참고

### 2. `EXPO_GO_E2E.md` (448줄)
**내용:** Expo Go 로컬 개발 단계 E2E 테스트 가이드

**핵심 섹션:**
- 🔧 Expo Go 시작 (npx expo start --ios)
- 🧪 Phase 1 (FOMO): 쿨다운 검증, 재발동 방지 테스트
- 🧪 Phase 2 (RevenueCat): Trial/Ended/Subscribed 3가지 UI 시나리오
- 🧪 Phase 3 (Push): 포그라운드/백그라운드 알림 도착 확인
- 📊 Supabase SQL 조회 쿼리 (상태 확인용)
- 🔍 이슈 디버깅 팁
- ➡️ EAS Build 다음 단계

**사용 시점:** Expo Go 로컬 테스트 또는 이슈 디버깅 시 참고

### 3. `CLAUDE.md` (핵심 부분만 재확인)
**변경 없음** — S2 코드에서 Lock 1~5 모두 적용 완료

---

## 🔑 신규 스레드 필수 실행 항목

### Step 1️⃣: Supabase 마이그레이션 적용 (15분)
**위치:** Supabase Dashboard > SQL Editor

#### Migration 009 — pg_cron FOMO 자동 실행

```sql
-- 1단계: 확장 활성화
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2단계: 기존 스케줄 제거 (있으면)
SELECT cron.unschedule('daily-fomo-check') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'daily-fomo-check'
);

-- 3단계: 새 스케줄 등록
SELECT cron.schedule(
  'daily-fomo-check',
  '0 7 * * 1-5',  -- KST 16:00 = UTC 07:00, 평일만
  $$
  SELECT net.http_post(
    url := concat(vault.decrypted_secret('SUPABASE_URL')::text, '/functions/v1/check-fomo'),
    headers := jsonb_build_object(
      'Authorization', concat('Bearer ', vault.decrypted_secret('SUPABASE_SERVICE_ROLE_KEY')::text),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) FROM public.users LIMIT 1000;
  $$
);

-- 4단계: 등록 확인
SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'daily-fomo-check';
```

**필수 확인:**
- [ ] `CREATE EXTENSION` 실행 성공
- [ ] `cron.schedule` 명령 성공
- [ ] `SELECT cron.job` 결과에 `daily-fomo-check` 표시됨

#### Migration 010 — users.push_token + fomo_alerts RLS

```sql
-- 1단계: push_token 컬럼 추가
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS push_token TEXT;

-- 2단계: fomo_alerts seen_at UPDATE RLS 정책
DROP POLICY IF EXISTS "fomo_alerts_seen_at_update" ON public.fomo_alerts;

CREATE POLICY "fomo_alerts_seen_at_update"
  ON public.fomo_alerts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3단계: 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_users_push_token
  ON public.users (push_token)
  WHERE push_token IS NOT NULL;

-- 4단계: 확인
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'push_token';
```

**필수 확인:**
- [ ] `ALTER TABLE` 실행 성공
- [ ] RLS 정책 생성 성공
- [ ] users 테이블에 push_token 컬럼 존재

---

### Step 2️⃣: RevenueCat 대시보드 설정 (20분)
**위치:** https://app.revenuecat.com → Projects → INVIT

#### 2-1) Entitlement 확인/생성
```
이름: premium
설명: Premium subscription - FOMO alerts + Coaching unlocked
```

- [ ] Entitlement 생성 또는 확인

#### 2-2) Product 등록 (App Store + Google Play)

**iOS App Store:**
```
Product ID: kr.invit.premium.month
Display Name: 프리미엄 월간 구독
Trial Configuration: 14일 Reverse Trial
Price: $11.99 (또는 자체 설정)
```

**Android Google Play:**
```
Product ID: kr.invit.premium.month
Display Name: 프리미엄 월간 구독
Trial: 14일
Price: 12,000 원 (또는 자체 설정)
```

- [ ] iOS Product 생성
- [ ] Android Product 생성

#### 2-3) Offering 설정

```
Default Offering: default
├─ Package: Premium Monthly
│  ├─ Product: kr.invit.premium.month (iOS + Android)
│  └─ Entitlement: premium
```

- [ ] Offering 생성 또는 확인

#### 2-4) API Key 저장

```bash
# .env.local에 추가 (이미 저장되어 있으면 확인만)
EXPO_PUBLIC_REVENUECAT_API_KEY=[RevenueCat에서 복사]
```

- [ ] Public API Key 확인
- [ ] `.env.local`에 저장

---

### Step 3️⃣: Expo 자격증명 확인 (10분)
**위치:** https://expo.dev → Projects → invit → Credentials

#### 3-1) iOS APNs 자격증명

```bash
eas credentials status --platform ios
```

**출력:**
```
✅ Apple Certificates are set up
  - Type: Apple Distribution Certificate
  - Expires: 2025-04-08
  - Team ID: [YOUR_TEAM_ID]
```

- [ ] APNs Key (.p8) 업로드 확인
  또는 EAS Dashboard에서 수동 업로드

#### 3-2) Android FCM 자격증명

```bash
eas credentials status --platform android
```

**출력:**
```
✅ Google Service Account JSON is set up
  - Server API Key: AIzaSy...
  - Sender ID: 123456789
```

- [ ] FCM Server API Key 업로드 확인
  또는 EAS Dashboard에서 수동 업로드

---

### Step 4️⃣: feature_flags 수동 활성화 (5분)
**위치:** Supabase Dashboard > SQL Editor

```sql
-- 1단계: feature_flags 테이블 확인
SELECT key, enabled FROM feature_flags 
WHERE key IN ('fomo_alert', 'subscription');

-- 2단계: 활성화 (둘 다 true로)
UPDATE feature_flags SET enabled = true WHERE key = 'fomo_alert';
UPDATE feature_flags SET enabled = true WHERE key = 'subscription';

-- 3단계: 확인
SELECT key, enabled FROM feature_flags 
WHERE key IN ('fomo_alert', 'subscription');

-- 기대 결과:
-- fomo_alert    | true
-- subscription  | true
```

- [ ] fomo_alert = true
- [ ] subscription = true

---

## 🧪 신규 스레드 테스트 플로우

### Expo Go 로컬 테스트 (20분)

#### Setup:
```bash
cd c:/Users/jerry/invit

# 1. 로컬 상태 확인
npx tsc --noEmit  # TypeScript 에러 0건 확인

# 2. Expo 개발 서버 시작
npx expo start --ios
# 또는 실기기: QR 코드 스캔

# 3. 앱 로드 (30초~1분)
```

#### Phase 1 테스트 (FOMO 경보):
```bash
# 터미널에서 curl로 FOMO 경보 트리거:
curl -X POST https://[project].supabase.co/functions/v1/check-fomo \
  -H "Authorization: Bearer [anon-key]" \
  -H "Content-Type: application/json" \
  -d '{"kospi_change_pct": 2.5, "volume_change_pct": 160}'

# 앱 화면:
# 1. H01_Home에 FomoAlertBanner 표시 확인
# 2. "확인했습니다" 클릭 → 배너 자동 숨김
```

- [ ] FomoAlertBanner 표시
- [ ] dismissAlert 동작

#### Phase 2 테스트 (RevenueCat):
```
# 앱 화면:
# 1. ST01_Settings > "구독 관리" 클릭
# 2. SubscriptionScreen 진입
# 3. 상단 구독 상태 텍스트 표시 확인
#    - "무료 (체험 종료)" 또는 "무료 체험 14일 남음"
# 4. "구독 시작하기" 또는 "프리미엄 구독하기" CTA 표시 확인
```

- [ ] SubscriptionScreen 네비게이션
- [ ] 구독 상태 텍스트 표시

#### Phase 3 테스트 (Expo Push):
```
# 앱 화면:
# 1. 로그인 시 "알림 전송을 허용할까요?" → 허용
# 2. Supabase에서 users.push_token 저장 확인

# 터미널에서 FOMO 경보 트리거:
curl -X POST https://[project].supabase.co/functions/v1/check-fomo \
  -H "Authorization: Bearer [anon-key]" \
  -H "Content-Type: application/json" \
  -d '{"kospi_change_pct": 2.5, "volume_change_pct": 160}'

# 앱 화면:
# 1. 상단에 Push 알림 토스트 표시
#    - 제목: "INVIT FOMO 경보"
#    - 본문: "오늘 시장이 크게 올랐습니다..."
```

- [ ] Push 권한 요청
- [ ] Push 토큰 저장 (users.push_token 확인)
- [ ] Push 알림 도착

---

## 🔧 명령어 레퍼런스

### Supabase 확인
```sql
-- 마이그레이션 상태
SELECT * FROM storage.migrations ORDER BY name DESC LIMIT 5;

-- pg_cron 작업 상태
SELECT jobname, schedule, command FROM cron.job;

-- FOMO 경보 이력
SELECT id, user_id, alert_type, direction, kospi_change_pct, created_at 
FROM fomo_alerts 
ORDER BY created_at DESC LIMIT 10;

-- Push 토큰 확인
SELECT id, push_token FROM users WHERE id = '[current-user-id]';

-- feature_flags 상태
SELECT key, enabled FROM feature_flags WHERE key IN ('fomo_alert', 'subscription');
```

### 로컬 개발 (Bash)
```bash
# TypeScript 컴파일 체크
npx tsc --noEmit

# 패키지 버전 확인
npm list expo-notifications expo-device react-native-purchases

# Expo Go 시작 (iOS 시뮬레이터)
npx expo start --ios

# Expo Go 시작 (실기기 - QR 코드 스캔)
npx expo start

# Git 상태 확인
git log --oneline -10
git status
```

---

## ⚠️ 예상 이슈 및 대응

| 증상 | 원인 | 해결책 |
|------|------|--------|
| `FomoAlertBanner` 미표시 | `feature_flags.fomo_alert = false` | SQL: `UPDATE feature_flags SET enabled=true WHERE key='fomo_alert'` |
| FOMO EF 500 에러 | KRX_API_KEY Secret 오류 | Supabase Secrets 재확인 + `SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'KRX_API_KEY'` |
| `pg_cron` 작업 미실행 | 마이그레이션 009 미적용 | SQL Editor에서 Migration 009 재실행 |
| Push 토큰 NULL | 권한 거부 또는 미호출 | AuthContext 로그 확인 + 권한 팝업 허용 재확인 |
| RevenueCat 결제 창 미표시 | Entitlement/Product 미등록 | RevenueCat 대시보드 Entitlement/Product/Offering 생성 확인 |
| `cron.schedule` 에러 | vault.decrypted_secret 실패 | Supabase Secrets 이름 정확성 확인 (KRX_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) |
| EAS Build 실패 | eas.json 누락 또는 credentials 미설정 | `cat eas.json` 확인 + `eas credentials status --platform [ios/android]` |

---

## 📌 핵심 체크포인트

### 신규 스레드 시작 체크리스트
- [ ] Supabase 마이그레이션 009 실행 + `cron.jobs` 확인
- [ ] Supabase 마이그레이션 010 실행 + `users.push_token` 컬럼 확인
- [ ] RevenueCat Entitlement/Product/Offering 생성
- [ ] Expo 자격증명 (APNs/FCM) 설정
- [ ] feature_flags 수동 활성화
- [ ] `npx tsc --noEmit` TypeScript 에러 0건
- [ ] Expo Go E2E 테스트 (Phase 1/2/3) 수행

### 다음 스레드 시작 명령어
```bash
cd c:/Users/jerry/invit

# 상태 확인
git log --oneline -5

# 문서 로드
cat HANDOVER.md
cat EXPO_GO_E2E.md
cat CLAUDE.md

# Supabase 마이그레이션 적용
# → Dashboard SQL Editor에서 migration 009, 010 복사-붙여넣기

# RevenueCat 대시보드 설정
# → https://app.revenuecat.com/projects/INVIT

# Expo Go 테스트 시작
npx tsc --noEmit
npx expo start --ios
```

---

## 📊 S2 Sprint 진행 상황

```
✅ SafeAreaView 버그 해결 (4bc44eb)
  ├─ ScrollView flex: 1 + SafeAreaView 정규화
  └─ 11개 화면 모두 수정

✅ S2 Phase 1 — FOMO 경보 코드 완성
  ├─ check-fomo EF (KOSPI API 자동조회)
  ├─ pg_cron 스케줄 (migration 009)
  ├─ FomoAlertBanner 컴포넌트
  └─ useFomoAlert hook

✅ S2 Phase 2 — RevenueCat 구독 코드 완성
  ├─ revenuecat.ts 라이브러리
  ├─ useSubscription hook
  ├─ SubscriptionScreen (3가지 UI)
  └─ AuthContext 자동 연결

✅ S2 Phase 3 — Expo Push 코드 완성
  ├─ notifications.ts 라이브러리
  ├─ AuthContext 토큰 자동 등록
  ├─ check-fomo EF Push 발송
  └─ migration 010 (push_token + RLS)

⏳ 인프라 설정 대기
  ├─ Supabase 마이그레이션 009/010
  ├─ RevenueCat 대시보드 설정
  ├─ Expo 자격증명
  └─ feature_flags 수동 활성화

🚀 다음: Expo Go E2E 테스트 + EAS Build
```

---

## 📝 노트

**Lock 준수 현황:**
- ✅ Lock 1 — 클라이언트 LLM/DB쓰기 금지 (Edge Function 전용)
- ✅ Lock 2 — feature_flags 기본 OFF (fomo_alert, subscription)
- ✅ Lock 3 — 데이터 4계층 + RLS (users/fomo_alerts)
- ✅ Lock 4 — Idempotency (UNIQUE + upsert)
- ✅ Lock 5 — 비용 가드레일 (ai_call_logs)
- ⏭️ Lock 6/7 — S3에서 generate-coaching EF 구현

**다음 단계 (Phase 2+):**
- [ ] generate-coaching EF (GPT-4o-mini + 투자자문 필터)
- [ ] submit-bias-assessment EF (재진단 로직)
- [ ] calculate-discipline EF (규율 점수 일일 배치)
- [ ] Phase 2 인프라: pgvector RAG, 추가 Edge Function

---

## 🎯 최종 목표

**S2 완료 조건:**
1. ✅ 코드 구현 100% 완료
2. ⏳ 인프라 설정 (이 스레드 1시간)
3. ⏳ E2E 테스트 통과
4. ⏳ 내부 베타 (TestFlight + Google Play Internal)

**S3 준비:**
- generate-coaching, submit-bias-assessment EF
- calculate-discipline pg_cron 배치
- 코칭 아키타입별 템플릿 DB

---

**이 문서는 신규 스레드에서 다음과 같이 사용하세요:**
1. 첫 번째 작업: Supabase 마이그레이션 (Step 1)
2. 두 번째 작업: RevenueCat 설정 (Step 2)
3. 세 번째 작업: Expo 자격증명 (Step 3)
4. 네 번째 작업: feature_flags 활성화 (Step 4)
5. 다섯 번째 작업: Expo Go E2E 테스트 → 이슈 발생 시 버그픽스
