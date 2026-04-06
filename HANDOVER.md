# S2 완료 → S2 Infra + Beta 인수인계서
**작성일:** 2026-04-06 | **최종 커밋:** `ccb8cc4` | **상태:** 코드 완료, 인프라 설정 대기

---

## Executive Summary

**이전 스레드 완료:**
- SafeAreaView 겹침 버그 해결 (commit `4bc44eb`)
- S2 Sprint 3단계 전부 코드 구현 완료:
  - **Phase 1 — FOMO:** check-fomo EF + pg_cron + UI 컴포넌트
  - **Phase 2 — 결제:** RevenueCat SDK + 페이월 화면
  - **Phase 3 — Push:** Expo Push + 토큰 관리

**현 스레드 할 일:**
1. Supabase 마이그레이션 적용 (009, 010)
2. RevenueCat + Expo 서비스 연동
3. feature_flags 수동 활성화 (Lock 2)
4. EAS Build & 실기기 베타 테스트
5. 이슈 발견 시 버그 픽스

---

## 코드 완료 체크리스트

### Phase 1 — FOMO 경보
- [x] `supabase/functions/check-fomo/index.ts` — KOSPI API 자동조회 + FOMO Threshold LOCK v1.0
  - 이중 모드: 수동 파라미터 (테스트) vs 자동 KOSPI API 조회 (pg_cron)
  - 거래량 계산: 20일 이동평균 기반 (API 응답에서 직접 계산)
  - 쿨다운: 동일 방향 24시간 내 재발동 금지
  - Expo Push 발송: upsert 후 users.push_token으로 즉시 발송
  - Step 5 (로그): ai_call_logs INSERT (생략 불가)
  - Step 6 (upsert): fomo_alerts UNIQUE(user_id, alert_date, direction)
  
- [x] `supabase/migrations/009_pg_cron_fomo.sql` (미적용 ⚠️)
  - pg_cron + pg_net 확장 활성화
  - 스케줄: `0 7 * * 1-5` (KST 16:00 = UTC 07:00, 평일만)
  - vault.decrypted_secrets로 SUPABASE_URL, SERVICE_ROLE_KEY 안전 조회
  - 최대 1000명 배치 처리 (MVP 한계)
  
- [x] `src/hooks/useFomoAlert.ts`
  - feature_flags.fomo_alert 체크 (Lock 2)
  - 당일 미확인 경보 쿼리 (seen_at IS NULL)
  - dismissAlert(): 본인 레코드만 seen_at UPDATE 가능 (RLS)
  
- [x] `src/components/FomoAlertBanner.tsx`
  - Colors.warning (#DA7101) 배경 + 좌측 보더
  - 방향 이모지 (📈 surge / 📉 plunge) + kospi_change_pct 표시
  - "확인했습니다" 버튼 (로딩 상태 포함)
  
- [x] `src/screens/H01_Home.tsx` — FomoAlertBanner 연동
  - 헤더 아래 배너 렌더링
  - dismissAlert 콜백 처리

### Phase 2 — RevenueCat 구독
- [x] `src/lib/revenuecat.ts` — 완전 구현
  - `configureRevenueCat()`: EXPO_PUBLIC_REVENUECAT_API_KEY 초기화
  - `loginRevenueCat(userId)`: Supabase user.id 연결
  - `logoutRevenueCat()`: 로그아웃
  - `checkPremiumEntitlement()`: 'premium' entitlement 확인
  - `getTrialStatus()`: periodType === 'TRIAL' 검사 + 남은 일수 계산
  - `getCurrentOffering()`: 월별 구독권 조회
  - `restorePurchases()`: 구매 복원
  
- [x] `src/hooks/useSubscription.ts`
  - feature_flags.subscription 체크 (Lock 2)
  - 상태 반환: featureEnabled, isPremium, isTrialActive, isSubscribed, trialDaysRemaining, offering
  - `purchasePremium()`: 월별 패키지 구매 실행
  - `restorePurchases()`: 구매 복원
  
- [x] `src/screens/SubscriptionScreen.tsx` — 3단계 페이월
  - **Trial 활성:** "남은 무료 체험 N일" + 기능 리스트 + "구독 시작하기" CTA
  - **Trial 종료:** ⚠️ 배너 + "프리미엄 구독 ₩9,900/월" CTA
  - **구독 중:** ✅ 배너 + "투자 원칙을 지키는 여정..." + "구독 관리 (스토어)" 버튼
  - Restore 버튼 (항상 표시)
  - 법적 자동갱신 문구 (하단 고정)
  
- [x] `src/contexts/AuthContext.tsx` — RevenueCat 자동 연결
  - 로그인 시: loginRevenueCat(session.user.id)
  - 로그아웃 시: logoutRevenueCat() 먼저 실행
  
- [x] `src/navigation/types.ts`
  - MainStackParamList에 `Subscription: undefined` 추가
  
- [x] `src/screens/ST01_Settings.tsx` — 구독 상태 연동
  - 동적 상태 텍스트: "프리미엘 구독 중" / "무료 체험 N일 남음" / "무료 (체험 종료)"
  - 색상: success green / primary teal / warning orange
  - "구독 관리" row → `navigation.navigate('Subscription', undefined)`
  
- [x] `App.tsx` — RevenueCat 초기화 + 라우트 등록
  - useEffect에서 configureRevenueCat() 호출 (한 번만)
  - MainStack에 SubscriptionScreen 등록
  - import { SubscriptionScreen }

### Phase 3 — Expo Push 알림
- [x] `package.json` — expo-notifications, expo-device 설치 완료
  - 패키지 버전 확인: `npm list expo-notifications expo-device`
  
- [x] `app.json` — expo-notifications 플러그인 설정
  ```json
  "plugins": [
    ["expo-notifications", {
      "icon": "./assets/icon.png",
      "color": "#01696F"
    }]
  ]
  ```
  
- [x] `src/lib/notifications.ts` — 완전 구현
  - `registerForPushNotifications()`: 권한 요청 + Expo Push Token 획득 (실기기만)
  - Android 알림 채널: 'fomo-alerts' (HIGH 우선순위)
  - `savePushTokenToSupabase(userId, token)`: users.push_token UPDATE (RLS: auth.uid() = id)
  - `initPushNotifications(userId)`: 원스톱 함수
  - Notification Handler: shouldShowBanner=true, shouldShowList=true 설정
  
- [x] `src/contexts/AuthContext.tsx` — Push 토큰 자동 등록
  - onAuthStateChange에서 initPushNotifications(session.user.id) 호출
  - 로그인 + RevenueCat 연결 동시 수행
  
- [x] `supabase/functions/check-fomo/index.ts` — Expo Push 발송 추가
  - Step 6 후처리: users.push_token 조회
  - `fetch('https://exp.host/--/api/v2/push/send', {...})` 호출
  - 실패 해도 경보 upsert 취소 안 함 (try/catch)
  - 성공 로그: `'Push notification sent to user: ${user.id}'`
  
- [x] `supabase/migrations/010_add_push_token.sql` (미적용 ⚠️)
  - `ALTER TABLE users ADD COLUMN push_token TEXT`
  - fomo_alerts seen_at UPDATE RLS 정책 추가 (auth.uid() = user_id만 허용)
  - 인덱스: push_token으로 빠른 조회 (EF 내부 최적화)

---

## 미적용 Supabase 마이그레이션 (⚠️ 우선 순위 높음)

### 마이그레이션 009 — pg_cron FOMO 자동 실행
**파일:** `supabase/migrations/009_pg_cron_fomo.sql`
**실행 위치:** Supabase Dashboard > SQL Editor

**내용:**
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('daily-fomo-check') WHERE EXISTS (...);

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
    body := '{}' ::jsonb,
    timeout_milliseconds := 30000
  ) FROM public.users LIMIT 1000;  -- MVP: 배치 1000명 한계
  $$
);
```

**필요 사전작업:**
1. Supabase Secrets 확인: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 이미 등록됨
2. 실행 후 `SELECT cron.jobs;` 로 `daily-fomo-check` 항목 확인
3. pg_cron 로그: `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;`

### 마이그레이션 010 — users.push_token + fomo_alerts RLS
**파일:** `supabase/migrations/010_add_push_token.sql`
**실행 위치:** Supabase Dashboard > SQL Editor (009 후 실행)

**내용:**
- `ALTER TABLE users ADD COLUMN push_token TEXT`
- fomo_alerts seen_at UPDATE 정책: `auth.uid() = user_id` (Lock 3)
- 인덱스: `CREATE INDEX idx_users_push_token ON users(push_token) WHERE push_token IS NOT NULL`

---

## 서비스 연동 체크리스트

### 1️⃣ RevenueCat 대시보드 설정 (필수)

**위치:** https://app.revenuecat.com → Projects → INVIT

#### 1-1) Entitlement 확인
- [ ] Entitlement 이름: `premium` (Lock 2 기준)
- [ ] 설명: "Premium subscription - FOMO alerts + Coaching unlocked"

#### 1-2) Product 등록 (App Store + Google Play 각각)
**iOS:**
- [ ] Product ID: `kr.invit.premium.month` (App Store Connect과 일치)
- [ ] Display Name: "프리미엄 월간 구독"
- [ ] Trial: 14일 (Reverse Trial = 구매 후 Trial 시작)

**Android:**
- [ ] Product ID: `kr.invit.premium.month` (Google Play Console과 일치)
- [ ] Display Name: "프리미엄 월간 구독"
- [ ] Trial: 14일

#### 1-3) Offering 설정
- [ ] Default Offering: `default`
- [ ] 포함 Product: `kr.invit.premium.month`
- [ ] Entitlement: `premium`

#### 1-4) API Key 확인
- [ ] Stripe API Key (비용 결제 테스트용) — 선택사항, 베타는 Sandbox 모드
- [ ] Public API Key: `.env` → `EXPO_PUBLIC_REVENUECAT_API_KEY`

### 2️⃣ Expo 설정 (필수)

**위치:** https://expo.dev → Projects → invit

#### 2-1) EAS 설정
- [ ] `eas.json` 존재 (commit `ccb8cc4`에서 자동 생성)
- [ ] eas login (이미 수행)

#### 2-2) Push 알림 자격증명
**iOS:**
- [ ] Apple Developer Team ID 확인
- [ ] APNs Key (.p8) Expo에 업로드 (EAS 대시보드 > Credentials)

**Android:**
- [ ] Google Cloud 프로젝트 → FCM 활성화
- [ ] Sender ID + Server API Key → Expo에 업로드

#### 2-3) 확인 명령
```bash
# Expo 자격증명 상태 확인
eas credentials status --platform ios
eas credentials status --platform android
```

### 3️⃣ Supabase Secrets 확인 (필수)

**위치:** Supabase Dashboard > Settings > Secrets

**필요 Secret:**
```
KRX_API_KEY = [공공데이터포털 API Key]
SUPABASE_URL = https://[project].supabase.co
SUPABASE_SERVICE_ROLE_KEY = [service role key]
```

**확인 명령:**
```sql
-- Supabase SQL Editor에서
SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'KRX_API_KEY';
```

### 4️⃣ feature_flags 수동 활성화 (Lock 2)

**실행 시점:** Supabase 마이그레이션 + RevenueCat/Expo 모두 완료 후

```sql
-- Supabase SQL Editor에서
UPDATE feature_flags SET enabled = true WHERE key = 'fomo_alert';
UPDATE feature_flags SET enabled = true WHERE key = 'subscription';

-- 확인
SELECT key, enabled FROM feature_flags WHERE key IN ('fomo_alert', 'subscription');
```

---

## 실기기 테스트 플로우

### Phase 1 — FOMO 경보 테스트
1. **pg_cron 수동 트리거 (매직 없이):**
   ```bash
   curl -X POST https://[project].supabase.co/functions/v1/check-fomo \
     -H "Authorization: Bearer [anon-key]" \
     -H "Content-Type: application/json" \
     -d '{"kospi_change_pct": 2.5, "volume_change_pct": 160}'
   ```
   → fomo_alerts 테이블에 데이터 INSERT 확인

2. **H01_Home 화면:**
   - [ ] FomoAlertBanner 표시 (feature_flags.fomo_alert = true일 때)
   - [ ] "확인했습니다" 클릭 → seen_at UPDATE 확인
   - [ ] 배너 자동 숨김

### Phase 2 — 결제 플로우 테스트
1. **ST01_Settings 구독 상태:**
   - [ ] 로그인 직후: "무료 (체험 종료)" 또는 "무료 체험 N일 남음" 표시
   
2. **SubscriptionScreen 페이월:**
   - [ ] "구독 시작하기" 클릭
   - [ ] RevenueCat 결제 창 표시 (iOS: App Store, Android: Google Play)
   - [ ] 결제 완료 후: entitlement 상태 업데이트 확인
   - [ ] 구독 상태: "프리미엄 구독 중" 표시

3. **Sandbox 모드 (테스트 결제):**
   - [ ] iOS TestFlight: Sandbox Apple ID 사용
   - [ ] Android: Google Play Console > Internal Testers 자동갱신 테스트

### Phase 3 — Push 알림 테스트
1. **로그인 시 Push 권한:**
   - [ ] iOS: "INVIT가 알림 전송을 허용할까요?" → 허용 클릭
   - [ ] Android: 자동 권한 (targetSdkVersion >= 33)

2. **Push 토큰 확인:**
   ```sql
   SELECT id, push_token FROM users WHERE id = '[current-user-id]' LIMIT 1;
   ```
   → push_token이 `ExponentPushToken(...)` 형식 확인

3. **FOMO 경보 Push:**
   - check-fomo 실행 → fomo_alerts INSERT 성공
   - Expo Push API 호출 → 실기기에 알림 도착 확인
   - 앱 포그라운드: FomoAlertBanner 동시 표시
   - 앱 백그라운드: OS 네이티브 알림 표시

---

## 예상 이슈 및 대응

| 증상 | 원인 | 해결책 |
|------|------|--------|
| pg_cron 미실행 | Supabase 마이그레이션 미적용 | migration 009 SQL 실행 확인 |
| FomoAlertBanner 미표시 | feature_flags.fomo_alert = false | SQL로 enabled = true 설정 |
| RevenueCat 결제 창 미표시 | Entitlement/Product 미등록 또는 API Key 오류 | RevenueCat 대시보드 설정 재확인 |
| Push 알림 미도착 | 실기기 테스트 안 함 (시뮬레이터 불가) | 실기기에서 EAS Build 설치 테스트 |
| Push 토큰 NULL | initPushNotifications 미호출 또는 권한 거부 | AuthContext onAuthStateChange 로그 확인 |
| KOSPI API 500 에러 | KRX_API_KEY 잘못됨 또는 API 서버 장애 | check-fomo 에러 로그 확인 + Secrets 재확인 |

---

## 다음 스레드 시작 시 사용할 명령어

```bash
# 로컬 상태 확인
cd c:/Users/jerry/invit && git log --oneline -10

# TypeScript 컴파일 확인
npx tsc --noEmit

# 패키지 버전 확인
npm list expo-notifications expo-device react-native-purchases

# Supabase 마이그레이션 상태 확인
# → Dashboard > SQL Editor에서 직접 실행 (CLI 접근 불가)
```

---

## Lock & CLAUDE.md 검증 체크

**코드 반영 완료:**
- [x] Lock 1 — 클라이언트 직접 LLM/DB쓰기 금지: Edge Function 전용
- [x] Lock 2 — feature_flags 기본 OFF: fomo_alert, subscription = false (초기)
- [x] Lock 3 — 데이터 4계층 + RLS: users/fomo_alerts seen_at UPDATE 정책
- [x] Lock 4 — Idempotency: fomo_alerts UNIQUE(user_id, alert_date, direction) + upsert
- [x] Lock 5 — 비용 가드레일: ai_call_logs 기반 (Generate-coaching은 S2에 미포함)
- [x] Lock 6 — 투자자문 필터: Phase 2 generate-coaching EF (S2에 미포함)
- [x] Lock 7 — PII 외부 반출 금지: Phase 2 generate-coaching (S2에 미포함)

**CLAUDE.md와 차이점:**
- ❌ generate-coaching, submit-bias-assessment EF는 S3에서 구현
- ❌ pgvector RAG는 Phase 2 이관
- ✅ FOMO 경보, RevenueCat, Expo Push는 S2 완성

---

## 요약

**현 상태:** 코드 100% 완료, 인프라 설정 60% (Supabase 마이그레이션 미적용)

**신규 스레드 요청사항:**
1. Supabase 마이그레이션 009/010 적용 (SQL 복사-붙여넣기)
2. RevenueCat + Expo 자격증명 확인
3. feature_flags 수동 활성화
4. `eas build --profile development --platform ios` 및 실기기 테스트
5. 이슈 발생 시 즉시 버그픽스 + 반복 테스트

**예상 소요 시간:** 1~2시간 (서비스 연동이 대부분)
