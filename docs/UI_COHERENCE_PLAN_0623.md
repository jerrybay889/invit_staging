# INVIT UI 정합성(Coherence) 감사 & 보완 업그레이드 작업 계획서

> 작성: 2026-06-23 · 방법론: StyleSeed 4축 정합성 + AI-UI 안티패턴 · 대상: `invit-staging` (master)
> 토큰값 SSOT: `src/constants/{theme,colors}.ts` + `CLAUDE.md Color System` (StyleSeed 제안값이 아닌 **실제 INVIT 토큰 우선**)

---

## 0. 스코프 정정 (먼저 확인)

전달받은 StyleSeed 프롬프트는 스택을 **"Next.js + FastAPI + React Native"** 로 가정하나, INVIT 실제 스택은 **React Native + Expo (Managed) + Supabase** 단일이다(Next.js·FastAPI 없음 — `CLAUDE.md` Executive Summary). 따라서:

- ✅ **채택:** StyleSeed의 *방법론* — 4축(Radius·Color·Spacing·Shadow) 단일기준 + AI-UI 안티패턴 목록 + 컴포넌트별 자가검증.
- ✅ **재정의:** *토큰값* 은 INVIT SSOT 기준으로 매핑. 특히 프롬프트의 `--color-fomo-alert:#a13544` 는 INVIT의 **Jenova Maroon `#A12C7B`** 와 불일치 → INVIT 값으로 교정.
- ❌ **제외:** CSS 변수(`oklch`, `--radius-*`)·Tailwind·웹 전용 규칙은 RN `StyleSheet` 환경에 직접 적용 불가 → RN 토큰 객체(`Radius`, `Spacing`, `Shadow`, `Colors`)로 변환.

> 참고: `temp/INVIT_Investor_Prototype_v2.html` 는 **투자자 시연용 단일 HTML** 이며 본 앱 코드와 별개다(그라디언트 등 자유 사용 OK). 본 감사 대상은 **`src/` RN 앱 코드 26개 tsx** 다.

---

## 1. 정합성 감사 결과 (정량)

### 종합 스코어카드

| 축 | 상태 | 핵심 지표 | 판정 |
|----|------|-----------|------|
| **Shadow** | 🟢 PASS | 인라인 그림자 **0건**, 전부 `Shadow.card/elevated/modal` 3단계 경유 | 정합 완료 |
| **Radius** | 🔴 FAIL | 토큰 채택률 **53%** (토큰 63 / 하드코딩 56) · 하드코딩 **15종 값** vs 허용 6종 | 최우선 |
| **Color** | 🟡 PARTIAL | 하드코딩 hex **31건** · 브랜드 컬러 **이중 시스템**(아래) | 보완 필요 |
| **Spacing** | 🟡 PARTIAL | 대부분 4px 배수 OK이나 **스케일이 과소**(최다 사용값 12·20이 토큰에 부재) | 스케일 확장 |

### 1-A. Radius — 🔴 최우선 (채택률 53%)

하드코딩된 `borderRadius` 값 분포 (총 56건, **15종**):

```
3(×3) 4(×9) 5(×2) 6(×4) 8(×10) 10(×4) 11(×1) 12(×9) 13(×1) 14(×4) 16(×2) 20(×4) 24(×1) 32(×1) 50(×1)
```

허용 토큰은 6종뿐: `Radius = {xs:6, sm:8, md:14, lg:18, xl:22, full:9999}`.
→ `3·4·5·10·11·12·13·16·20·24·32·50` 은 **전부 오프토큰**. 시각적으로 "버튼마다 모서리가 미묘하게 다른" 정합성 균열의 직접 원인.

**최다 오프토큰 파일:** `P01_PrincipleManage`(12) · `J02_JournalView`(7) · `SubscriptionScreen`(6) · `IN01_Insights`(6) · `ST01_Settings`(5).
**신규 미커밋 파일이 토큰 0% 사용:** `StockSearchInput`(Radius 0/하드 3) · `PhonePreviewFrame`(0/2) — 신규 코드가 토큰을 우회하며 작성됨 → 회귀 방지 규칙 필요.

### 1-B. Color — 🟡 이중 시스템 발견

하드코딩 hex **31건** (최다: `AssessmentResultScreen` 7 · `IN01_Insights` 7 · `BiasQuestionCard` 6 · `PhonePreviewFrame` 5).

**더 심각한 구조 문제 — 브랜드 컬러 이중화:** `colors.ts` 내부에 브랜드와 충돌하는 제너릭(Tailwind) 팔레트가 공존.

| 용도 | 현재 discipline 값 | 브랜드 SSOT 값 | 문제 |
|------|-------------------|----------------|------|
| 위험/낮음 | `disciplineRed #DC2626` | `error #A12C7B` (Jenova Maroon) | 화면마다 빨강이 2종 |
| 주의/보통 | `disciplineGold #D97706` | `warning #DA7101` (Costa Orange) | 화면마다 주황이 2종 |

→ 규율점수 카드는 Tailwind 빨강/주황을, FOMO 배너는 브랜드 마룬/오렌지를 써서 **같은 "위험" 의미가 다른 색**으로 표현됨. StyleSeed RULE 2(시맨틱 3종 이내) 위반.

**미결 결정 잔존:** `primaryHighlight:'#007880'` 주석에 *"Jerry 서면 확정 후 primary 대체 예정"* — v2.1 정제 틸 채택 여부 미정 상태로 코드에 방치.

### 1-C. Spacing — 🟡 스케일이 현실보다 과소

실사용 `padding*` 값 분포 핵심:

```
온그리드 다빈도:  12(×34)  16(×37)  14(×19)  20(×15)  24(×16)  10(×21)  8(×10)
오프그리드(4px×):  2(×1) 3(×4) 5(×6) 6(×5) 7(×3) 11(×1) 13(×1)
```

정의된 스케일 `Spacing = {xs:4, sm:8, md:16, lg:24, xl:32, xxl:48}` 은 **8 → 16 사이가 비어**, 가장 많이 쓰이는 **12(×34)·20(×15)** 를 표현할 토큰이 없다. 그 결과 개발자가 매번 `12`·`20`·`10`·`14` 를 손으로 적게 되고, 이것이 오프그리드(`10`·`14`)까지 번지는 원인. **스케일 자체를 현실에 맞게 확장**해야 근본 해결.

### 1-D. 안티패턴 점검 (RULE 6)

| 안티패턴 | 결과 | 조치 |
|----------|------|------|
| 그라디언트 버튼 (`LinearGradient`) | 🟢 **0건** | 양호 — 유지 |
| 컬러 사이드보더 (`borderLeft`) | 🟠 **13건 / 6파일** | **결정 필요**(아래 §3-D) |
| 아이콘 컬러 원형배경 (`full`/`50` 반경) | 🟡 14 후보 | 시각 트리아지(아바타=정상/기능아이콘=교체) |
| 3열 대칭 Feature Grid | 점검 대상 | 진단결과·인사이트 화면 레이아웃 검토 |

`borderLeft` 출처는 **`ui/Card.tsx` 프리미티브의 `accent` prop**(line 20)이 구조적으로 좌측 보더를 생성 → `ArchetypeResultCard`·`FomoAlertBanner`·`H01`·`IN01`·`J01` 로 전파. 근원 1곳을 고치면 연쇄 정리 가능.

---

## 2. 보완 업그레이드 전략 (토큰 시스템 정제)

원칙: **비파괴 우선**(기존 키·값 보존) → **스냅 마이그레이션**(하드코딩 → 토큰) → **회귀 차단**(자가검증 게이트).

### 2-A. Radius — 6종 유지 + 스냅맵 강제

스케일은 이미 충분(6종). 문제는 채택률이므로 **신규 토큰 추가 없이** 전 하드코딩을 아래 맵으로 치환:

| 하드코딩 → | 토큰 | 용도 |
|-----------|------|------|
| 3·4·5·6 → | `Radius.xs` (6) | 칩·뱃지·입력 |
| 8·10·11 → | `Radius.sm` (8) | 소형 카드 내부 |
| 12·13·14 → | `Radius.md` (14) | 버튼·표준 카드 |
| 16·18 → | `Radius.lg` (18) | 대형 카드·모달 섹션 |
| 20·22·24·32 → | `Radius.xl` (22) | 바텀시트·히어로 |
| 50·9999 → | `Radius.full` | 원형 |

### 2-B. Spacing — 비파괴 확장(12·20 추가)

기존 6키 **값 전부 보존**하고 빈 구간만 메움 (18개 파일 무영향):

```ts
export const Spacing = {
  xs: 4, sm: 8,
  smd: 12,   // [신규] 최다 사용값 — 카드 내부 표준 간격
  md: 16, lg: 24, xl: 32, xxl: 48,
  // mlg: 20 추가 검토 — 카드 패딩 다빈도
} as const;
```

오프그리드 스냅: `2·3→4` · `5·6·7→8` · `10→smd(12)` · `13·14→md(16)` · `11→smd(12)`.

### 2-C. Color — 브랜드 단일화 + 미결 정리

1. **discipline 이중팔레트 제거:** `disciplineRed→error(#A12C7B)`, `disciplineGold→warning(#DA7101)` 로 통합(또는 Jerry가 규율점수 전용 팔레트를 *공식 채택*하면 SSOT에 명시). **둘 중 택1, 회색지대 종료.**
2. **하드코딩 31건 → `Colors.*` 치환** (신규 토큰이 필요하면 colors.ts에 명명 추가).
3. **`primaryHighlight` 미결 종결:** v2.1 정제 틸(`#007880`) primary 승격 여부 Jerry 확정 → 채택 시 `CLAUDE.md` Color Lock 동기화, 보류 시 주석 제거하고 보조용도 고정.

### 2-D. 안티패턴 — `borderLeft` 정책 결정 (Jerry)

StyleSeed는 컬러 사이드보더를 금지(상단 뱃지/배경 elevation로 대체)하나, INVIT에선 이게 **의미 신호**(FOMO=warning, 코칭활성=primary)로 기능 중. 두 방향:

- **(A) 유지·표준화:** `Card.tsx accent` 를 공식 패턴으로 인정, 폭 3px·색=시맨틱 3종으로 고정. (브랜드 표현 유지, 변경 최소)
- **(B) StyleSeed 정렬:** borderLeft 제거 → 상단 소형 뱃지/배경 surface로 상태 표현. (정합성 교과서적, 작업량 큼)

→ **권장: (A)** — 의미 전달이 명확하고 13건 모두 시맨틱 컬러를 이미 사용. 다만 폭(현재 3·4px 혼재)과 색 범위만 표준화.

---

## 3. 작업 계획 (Phase별)

> 전 Phase 공통 게이트: `npx tsc --noEmit` **EXIT 0** + 변경 화면 라이트/다크 양쪽 렌더 확인.

### Phase 1 — 토큰 시스템 정제 (반파괴, 0.5d)
- [ ] `theme.ts`: `Spacing.smd=12` (필요시 `mlg=20`) 추가. Radius 주석에 스냅맵 명시.
- [ ] `colors.ts`: discipline 이중팔레트 결정 반영(통합 또는 공식화). `primaryHighlight` 미결 종결.
- [ ] `CLAUDE.md` Color System 섹션과 동기화(변경 시).
- **DoD:** 토큰 파일이 실사용 값을 100% 표현 가능.

### Phase 2 — 프리미티브 & 신규파일 정합 (1d)
- [ ] `ui/Card.tsx`: `borderRadius` 토큰화 확인(이미 `Radius.md` ✓), `accent` 폭 3px 고정(정책 A).
- [ ] 신규 미커밋 파일 우선 교정: `StockSearchInput`(하드 3) · `PhonePreviewFrame`(하드 2) → 토큰 100%.
- [ ] `ui/{Pill,SectionLabel,StatCard}.tsx` 토큰 점검.
- **DoD:** 공유 프리미티브 4종 + 신규 2종 오프토큰 0.

### Phase 3 — 화면 스냅 마이그레이션 (2d, 오프토큰 多 순)
순서: `P01_PrincipleManage`(12) → `J02_JournalView`(7) → `SubscriptionScreen`(6) → `IN01_Insights`(6) → `ST01_Settings`(5) → `AssessmentResultScreen` → 나머지.
- [ ] 각 파일 `borderRadius`/`padding`/hex → 토큰 치환(스냅맵 적용).
- [ ] 파일별 커밋 분리(리뷰 용이).
- **DoD:** Radius 채택률 53% → **95%+**, 하드코딩 hex 31 → ≤5(불가피 케이스만 주석).

### Phase 4 — 안티패턴 & 자가검증 게이트 (0.5d)
- [ ] 아이콘 원형배경 14후보 트리아지(아바타 유지 / 기능아이콘 배경 제거).
- [ ] `borderLeft` 13건 폭·색 표준화(정책 A).
- [ ] (선택) `docs/` 에 COHERENCE 체크리스트 추가 + PR 템플릿에 자가검증 8항목 삽입.
- **DoD:** RULE 7 자가검증 8항목 PASS.

---

## 4. 검증 (RULE 7 자가검증 게이트)

각 화면 완료 후 출력:
```
[COHERENCE CHECK]
□ borderRadius 전부 Radius.* 토큰?
□ 컬러 Primary + 시맨틱(warning/error/success) 이내?
□ spacing 전부 Spacing.* (4px 그리드)?
□ shadow depth 한 화면 2단계 이내?  (현재 ✅ 유지)
□ 버튼 그라디언트 없음?  (현재 ✅ 유지)
□ 아이콘 컬러 원형배경 없음(아바타 제외)?
□ borderLeft 폭·색 표준 준수?
□ 다크모드 동일 규칙?
→ 전부 통과: ✅ INVIT UI Coherence PASS
```

회귀 차단(권장): `grep -rn "borderRadius: [0-9]" src --include=*.tsx | wc -l` 을 CI 경고 임계치로(예: >5 실패).

---

## 5. 리스크 & Jerry 결정 필요 항목

| # | 항목 | 선택지 | 권장 |
|---|------|--------|------|
| D1 | discipline 빨강/주황 vs 브랜드 마룬/오렌지 | 통합 / 전용팔레트 공식화 | **통합**(시맨틱 단일화) |
| D2 | `borderLeft` 사이드보더 | (A)유지·표준화 / (B)제거 | **(A)** |
| D3 | `primaryHighlight #007880` primary 승격 | 채택 / 보류 | 시각 비교 후 결정 |
| D4 | Spacing `mlg:20` 추가 여부 | 추가 / 20→24 스냅 | 사용빈도(15) 고려 **추가** |

- **비파괴 보장:** Phase 1 토큰 변경은 기존 키·값 보존이라 18개 파일 회귀 위험 없음.
- **PII/Lock 무관:** 본 작업은 순수 프레젠테이션 레이어 — `CLAUDE.md` Lock 1~7(AI경로·RLS·필터)과 무관, Edge Function 미접촉.
- **예상 공수:** 총 ~4 man-day (Phase 1: 0.5 / 2: 1 / 3: 2 / 4: 0.5).

---

## 부록 — 감사 원천 데이터 (2026-06-23 측정)

```
대상: src/**/*.tsx 26개 (theme import 18 · colors import 24)
Radius:  토큰 63 / 하드코딩 56 (15종 값) → 채택률 53%
Color:   하드코딩 hex 31건 · 브랜드 이중팔레트 2쌍
Spacing: 4px그리드 대체로 준수, 스케일 과소(12·20 토큰 부재)
Shadow:  인라인 0건 → 100% 토큰 (✅ 정합 완료)
안티패턴: gradient 0 ✅ / borderLeft 13(6파일) / icon-circle 14후보
```
