# Expo Go E2E 테스트 가이드 (S2 Infra + Beta)
**목적:** 로컬 개발 단계에서 EAS Build 전 빠른 검증  
**소요시간:** ~30분 (서비스 연동 완료 가정)  
**대상 기능:** FOMO 경보 + RevenueCat 구독 + Expo Push

---

## 시작 전 필수조건

```bash
# 1. Expo CLI 확인
npx expo --version  # v52.0.0 이상

# 2. Expo 로그인 (이미 완료했다면 생략)
npx expo login

# 3. 로컬 env 확인
cat .env.local  # 아래 항목 필수:
# EXPO_PUBLIC_SUPABASE_URL=https://[project].supabase.co
# EXPO_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
# EXPO_PUBLIC_REVENUECAT_API_KEY=[revenuecat-key]

# 4. Supabase 마이그레이션 적용 확인
# → Dashboard SQL Editor에서 migration 009, 010 실행 완료

# 5. feature_flags 활성화 확인
# → Supabase SQL: UPDATE feature_flags SET enabled=true WHERE key IN ('fomo_alert', 'subscription')
```

---

## Expo Go 테스트 (로컬)

### 단계 1: 개발 서버 시작

```bash
cd c:/Users/jerry/invit

# 방법 A: Expo Go로 개발 (가장 빠름)
npx expo start --clear

# 방법 B: Android 에뮬레이터
npx expo start --android

# 방법 C: iOS 시뮬레이터 (Mac만 가능)
npx expo start --ios
```

**출력:**
```
› Expo Go ready at http://localhost:8081
Scan the QR code above with Expo Go (Android) or the Camera app (iOS) to open your app
```

### 단계 2A: Expo Go 앱으로 스캔 (실기기)

**iOS:**
1. Expo Go 앱 열기 → 좌측 상단 "스캔" 버튼
2. QR 코드 스캔
3. 앱 로드 (30초~1분)

**Android:**
1. Expo Go 앱 열기
2. QR 코드 스캔
3. 앱 로드

### 단계 2B: 에뮬레이터에서 자동 로드
- `npx expo start --android` / `--ios` 실행하면 자동 로드

---

## Phase 1 — FOMO 경보 E2E 테스트

### 테스트 1: 로그인 + FomoAlert 쿼리

**목표:** 유저 인증 + H01_Home 화면 진입 확인

```bash
# 앱 화면:
1. S03_SignIn → test@invit.com / [password] 입력
2. "로그인" 클릭
3. 잠깐 로딩 후 H01_Home 진입

# 터미널 (개발 서버):
✓ 로그 확인: [AuthContext] Login successful: user.id = ...
✓ 로그 확인: [notifications] Push token saved successfully
```

**기대 결과:**
- [x] AuthContext 로그인 성공
- [x] users.push_token 저장 완료 (Supabase 확인)
- [x] FomoAlertBanner 미표시 (당일 경보 없음)

### 테스트 2: FOMO 경보 수동 트리거

**목표:** check-fomo EF 호출 → fomo_alerts INSERT → FomoAlertBanner 표시

```bash
# 터미널 (Supabase 대신 curl로 EF 호출):
curl -X POST https://[PROJECT].supabase.co/functions/v1/check-fomo \
  -H "Authorization: Bearer [ANON_KEY]" \
  -H "Content-Type: application/json" \
  -d '{
    "kospi_change_pct": 2.5,
    "volume_change_pct": 160
  }'

# 기대 응답:
{
  "success": true,
  "triggered": true,
  "alert_type": "surge_standard",
  "direction": "surge",
  "message": "오늘 시장이 크게 올랐습니다..."
}
```

**앱 화면:**
1. H01_Home에서 다시 로드 (Pull-to-Refresh 또는 Navigation 재진입)
2. FomoAlertBanner 표시 확인:
   - 📈 KOSPI +2.5%
   - 메시지 텍스트 표시
   - "확인했습니다" 버튼

3. "확인했습니다" 클릭
4. 배너 자동 숨김 확인

**Supabase 확인:**
```sql
-- fomo_alerts 테이블 확인
SELECT id, user_id, alert_type, direction, message, seen_at 
FROM fomo_alerts 
WHERE user_id = '[current-user-id]' 
ORDER BY created_at DESC LIMIT 1;

-- 기대: seen_at이 NULL (클릭 후) → NOW() 업데이트
```

### 테스트 3: 쿨다운 + 재발동 방지

```bash
# 다시 한 번 같은 방향(surge) FOMO 트리거
curl -X POST https://[PROJECT].supabase.co/functions/v1/check-fomo \
  -H "Authorization: Bearer [ANON_KEY]" \
  -H "Content-Type: application/json" \
  -d '{
    "kospi_change_pct": 2.5,
    "volume_change_pct": 160
  }'

# 기대 응답:
{
  "success": true,
  "triggered": false,
  "reason": "Cooldown active"
}

# 반대 방향(plunge) 트리거는 성공
curl -X POST https://[PROJECT].supabase.co/functions/v1/check-fomo \
  -H "Authorization: Bearer [ANON_KEY]" \
  -H "Content-Type: application/json" \
  -d '{
    "kospi_change_pct": -2.5,
    "volume_change_pct": 160
  }'

# 기대: triggered=true, alert_type="plunge_standard"
```

---

## Phase 2 — RevenueCat 구독 E2E 테스트

### 테스트 4: SubscriptionScreen 진입

**목표:** ST01_Settings → "구독 관리" → SubscriptionScreen 네비게이션 확인

```bash
# 앱 화면:
1. H01_Home → 좌측 하단 "S" (Settings)
2. ST01_Settings 진입
3. 상단에 구독 상태 텍스트 확인:
   - "무료 (체험 종료)" (첫 설치)
   - 또는 "무료 체험 14일 남음" (Trial 활성)

4. "구독 관리" row 클릭
5. SubscriptionScreen 진입

# 터미널 (개발 서버):
✓ 로그 확인: [revenuecat] Customer info loaded
✓ 로그 확인: [useSubscription] Trial status: { isTrialActive: ... }
```

**기대 결과:**
- [x] ST01_Settings에 구독 상태 텍스트 표시
- [x] "구독 관리" → SubscriptionScreen 네비게이션 성공

### 테스트 5: SubscriptionScreen UI 검증

**목표:** 3가지 상태에 따른 UI 렌더링 확인

#### Scenario A: Trial 활성 상태 (Trial 로그인)

```bash
# RevenueCat에서 Trial 사용자로 테스트하려면:
# 1. RevenueCat Dashboard → Sandbox mode 활성화
# 2. iOS TestFlight: Sandbox Apple ID 사용
# 또는 3. Android: Google Play Console > Internal Testing

# 앱 화면에서 확인할 항목:
- [ ] 상단: "남은 무료 체험 14일" 배지 (primary teal #01696F)
- [ ] 중앙: "다음 기능들을 사용할 수 있습니다" (기능 리스트)
- [ ] CTA: "구독 시작하기" 버튼 (primary teal)
- [ ] 하단: "복구" 버튼 (secondary)
```

#### Scenario B: Trial 종료 상태 (기본)

```bash
# 앱 화면에서 확인할 항목:
- [ ] 상단: "체험 기간이 종료되었습니다" 배지 (warning orange #DA7101)
- [ ] 중앙: "프리미엄 구독 ₩9,900/월" 텍스트
- [ ] CTA: "프리미엄 구독하기" 버튼 (primary teal)
- [ ] 하단: "복구" 버튼
```

#### Scenario C: 구독 활성 상태 (결제 후)

```bash
# 앱 화면에서 확인할 항목:
- [ ] 상단: "프리미엄 구독 중입니다" 배지 (success green #437A22)
- [ ] 중앙: "투자 원칙을 지키는 여정..." (배너 텍스트)
- [ ] CTA: "구독 관리 (앱 스토어)" 버튼 (gray secondary)
- [ ] 하단: "복구" 버튼
```

### 테스트 6: 결제 흐름 (Sandbox)

**iOS Sandbox 테스트:**

```bash
# 1. TestFlight 앱 설치 (미리 배포)
#    → eas build --profile development --platform ios 필수
# 2. SubscriptionScreen → "구독 시작하기"
# 3. "Sandbox Apple ID로 구매" 선택
#    - Email: test@sandbox.invit.com (예시)
#    - Password: Sandbox123!
# 4. 결제 확인
# 5. revenueCat SDK에서 entitlement 업데이트 감지
#    → SubscriptionScreen Scenario C로 자동 전환
```

**Android Sandbox 테스트:**

```bash
# 1. Google Play Console → Internal Testing 초대 수락
# 2. Play Store 앱 검색 → INVIT 설치
# 3. SubscriptionScreen → "구독 시작하기"
# 4. Google Play 결제 UI (라이센싱 테스트)
# 5. "Approved" 응답 후 entitlement 업데이트
```

**터미널 로그 확인:**
```
[revenuecat] Purchase initiated...
[revenuecat] Customer info updated
[useSubscription] Premium entitlement detected
```

---

## Phase 3 — Expo Push 알림 E2E 테스트

### 테스트 7: Push 권한 요청

**목표:** AuthContext에서 initPushNotifications() 자동 호출 확인

```bash
# 앱 화면:
1. 로그인 직후 (또는 앱 재시작)
2. iOS: "INVIT가 알림 전송을 허용할까요?" 팝업 → "허용"
3. Android: 자동 권한 (권한 팝업 없음, targetSdk >= 33)

# 터미널 (개발 서버):
✓ 로그 확인: [notifications] Push token saved successfully
✓ 또는 에러: [notifications] Push notification permission denied
```

**Supabase 확인:**
```sql
SELECT id, push_token FROM users WHERE id = '[current-user-id]' LIMIT 1;

-- 기대: push_token = 'ExponentPushToken([...])' (NULL 아님)
```

### 테스트 8: Push 알림 발송 (포그라운드)

**목표:** FOMO 경보 발송 → 앱 포그라운드 상태에서 FomoAlertBanner + Push 표시

```bash
# 앱 상태: H01_Home 열려있음

# 터미널에서 FOMO 트리거:
curl -X POST https://[PROJECT].supabase.co/functions/v1/check-fomo \
  -H "Authorization: Bearer [ANON_KEY]" \
  -H "Content-Type: application/json" \
  -d '{"kospi_change_pct": 2.5, "volume_change_pct": 160}'

# 앱 화면:
1. FomoAlertBanner 즉시 표시 (또는 새로고침 후)
2. 동시에 상단 Push 알림 토스트 표시:
   - 제목: "INVIT FOMO 경보"
   - 본문: "오늘 시장이 크게 올랐습니다..." (FOMO 메시지)

# 터미널 (개발 서버):
✓ 로그 확인: [check-fomo] Push notification sent to user: ...
```

### 테스트 9: Push 알림 발송 (백그라운드)

**목표:** 앱 백그라운드 상태에서 OS 네이티브 알림 표시

```bash
# 앱 상태: 백그라운드 (앱 완전 종료 또는 다른 앱 포그라운드)

# 터미널에서 FOMO 트리거:
curl -X POST https://[PROJECT].supabase.co/functions/v1/check-fomo \
  -H "Authorization: Bearer [ANON_KEY]" \
  -H "Content-Type: application/json" \
  -d '{"kospi_change_pct": -2.5, "volume_change_pct": 160}'

# 기대:
# iOS: 잠금화면/알림 센터에 "INVIT FOMO 경보" 알림 도착
# Android: 상단 상태 표시줄에 알림 표시

# 앱 탭 후:
1. SubscriptionScreen 또는 마지막 사용 화면 진입
2. FOMO 경보 이력 조회 가능 (향후 H06_AlertHistory에 추가)
```

### 테스트 10: Push 실패 시나리오

**목표:** 경보는 저장되지만 Push 실패해도 정상 작동 확인

```bash
# Expo.dev에서 Push Token 토큰 강제 무효화:
# 1. Expo Dashboard → Push Notifications → Token 삭제
# 또는
# 2. users.push_token = NULL로 수동 설정

# 다시 FOMO 트리거:
curl -X POST https://[PROJECT].supabase.co/functions/v1/check-fomo \
  -H "Authorization: Bearer [ANON_KEY]" \
  -H "Content-Type: application/json" \
  -d '{"kospi_change_pct": 2.5, "volume_change_pct": 160}'

# 기대:
# - fomo_alerts INSERT 성공 (Push 실패와 무관)
# - EF 응답: { "success": true, "triggered": true, ... }
# - Push 발송 미시도 또는 실패 (EF 로그에 non-critical 에러)
```

---

## E2E 테스트 체크리스트

### Phase 1 — FOMO
- [ ] 테스트 1: 로그인 + Push 토큰 저장
- [ ] 테스트 2: FOMO 경보 수동 트리거 → FomoAlertBanner 표시
- [ ] 테스트 3: 쿨다운 + 반대 방향 경보 허용

### Phase 2 — RevenueCat
- [ ] 테스트 4: ST01_Settings → SubscriptionScreen 네비게이션
- [ ] 테스트 5: Trial/Ended/Subscribed 3가지 상태 UI 검증
- [ ] 테스트 6: 결제 흐름 (Sandbox) — 선택사항 (TestFlight 필수)

### Phase 3 — Push
- [ ] 테스트 7: Push 권한 요청 + 토큰 저장
- [ ] 테스트 8: 포그라운드 Push 알림 (FomoAlertBanner + 토스트)
- [ ] 테스트 9: 백그라운드 Push 알림 (OS 네이티브)
- [ ] 테스트 10: Push 실패 시나리오 (경보 저장 확인)

---

## 로그 모니터링

### 개발 서버 터미널 (Expo)

```bash
# 필터링된 로그 보기:
npx expo start --clear 2>&1 | grep -E '\[(auth|notifications|revenuecat|check-fomo|fomo)\]'

# 모든 로그:
npx expo start --clear
```

### Supabase 로그

```sql
-- Edge Function 실행 로그
SELECT created_at, status_code, error_message 
FROM functions_logs 
WHERE function_name = 'check-fomo'
ORDER BY created_at DESC LIMIT 20;

-- fomo_alerts 상태 추적
SELECT created_at, user_id, alert_type, seen_at 
FROM fomo_alerts 
ORDER BY created_at DESC LIMIT 10;

-- users Push 토큰 확인
SELECT id, push_token, created_at 
FROM users 
WHERE id = '[current-user-id]';

-- ai_call_logs (비용 추적)
SELECT created_at, function_name, model, estimated_cost_usd 
FROM ai_call_logs 
WHERE user_id = '[current-user-id]'
ORDER BY created_at DESC LIMIT 10;
```

---

## 이슈 디버깅 팁

| 증상 | 확인 사항 | 해결책 |
|------|---------|-------|
| FomoAlertBanner 미표시 | feature_flags.fomo_alert 상태 | SQL: `SELECT enabled FROM feature_flags WHERE key='fomo_alert'` |
| FOMO EF 500 에러 | KRX_API_KEY Secret | Supabase Secrets 재확인 + KRX API 직접 호출 테스트 |
| Push 토큰 NULL | initPushNotifications 미호출 | AuthContext 로그 확인 + 권한 팝업 확인 |
| Push 발송 실패 | Expo.dev credentials 상태 | EAS Dashboard > Credentials > iOS/Android APNs/FCM 확인 |
| RevenueCat entitlement 미인식 | API Key 오류 | RevenueCat Dashboard > API Keys 재확인 |

---

## 다음 단계: EAS Build

Expo Go E2E 테스트 성공 후:

```bash
# 프로덕션 빌드 (TestFlight + Google Play 배포)
eas build --platform ios --auto-submit
eas build --platform android --auto-submit

# 참고: 각 단계별 인증서 설정 필요
```

