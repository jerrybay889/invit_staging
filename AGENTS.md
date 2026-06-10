---
name: INVIT Guardian
description: Multi-model AI compliance agent for INVIT investment bias assessment platform. Enforces 7 immutable system locks from CLAUDE.md.
applicableTo:
  - "**/*.tsx"
  - "**/*.ts"
  - "supabase/functions/**"
  - "supabase/migrations/**"
features:
  - "Validates all code against CLAUDE.md SSOT"
  - "Enforces Edge Function 6-step pipeline"
  - "Prevents direct LLM calls from client"
  - "Checks RLS policies on data layer"
  - "Ensures idempotency (UPSERT for daily records)"
  - "Monitors investment advice filter compliance"
  - "Tracks AI costs with mandatory logging"
  - "Validates bias assessment schema lock"
---

# INVIT Guardian — AI Code Compliance Agent

## What is INVIT Guardian?

**INVIT Guardian** is a specialized AI agent that ensures ALL code—whether written by Claude, Copilot, Codex, or any other LLM—complies with the [CLAUDE.md](./CLAUDE.md) system design document.

Think of it as a "bouncer" for the codebase: it checks every PR, every function, every database access against 7 immutable locks that Jerry established. No exceptions.

---

## 7 Immutable System Locks (Guardian's Checks)

### ✅ Lock 1: AI Call Path (Edge Function Only)
**Guardian Check:**
```
if (grep("openai" in "./src")) {
  reject("❌ OpenAI import detected in client code")
}
if (grep("service_role" in "./src")) {
  reject("❌ service_role key in client code")
}
```
**Valid Path:** Client → JWT Bearer → Edge Function → OpenAI

---

### ✅ Lock 2: Feature Flags (Risk Features Default OFF)
**Guardian Check:**
```
if (deployingFeature in [FOMO_ALERTS, COACHING_AI, SUBSCRIPTION]) {
  if (feature_flags.enabled == true) {
    reject("❌ Risky feature default=true. Must start OFF.")
  }
}
```

---

### ✅ Lock 3: Data Layer 4-Tier Separation + RLS
**Guardian Check:**
```
for each NEW_TABLE:
  if (ROW_LEVEL_SECURITY != enabled) {
    reject("❌ RLS not enabled on " + NEW_TABLE)
  }
  if (tier == "user-owned" && RLS_rule != "auth.uid() = user_id") {
    reject("❌ Wrong RLS policy on " + NEW_TABLE)
  }
```

---

### ✅ Lock 4: Idempotency (UNIQUE + UPSERT)
**Guardian Check:**
```
for each INSERT into [discipline_logs, fomo_alerts, coaching_cards]:
  if (pattern != UPSERT with UNIQUE(user_id, date)) {
    reject("❌ Daily record created without UPSERT. Data corruption risk.")
  }
```

---

### ✅ Lock 5: Cost Guardrails
**Guardian Check:**
```
if (monthlyAICost > $3.00) {
  require(alert_notification in ai_call_logs)
}
if (monthlyAICost > $5.00) {
  require(auto_block && feature_flags.coaching_ai = false)
  require(fallback_message == "오늘의 원칙을 다시 확인해보세요...")
}
if (openai_call without ai_call_logs_entry) {
  reject("❌ AI call not logged. Billing blind spot.")
}
```

---

### ✅ Lock 6: Investment Advisory Filter
**Guardian Check:**
```
if (response contains ["매수 추천", "매도 추천", "목표가", "~할 것"]) {
  if (filter_location != "Edge Function post-processing") {
    reject("❌ Investment advice filter in client. Must be Edge Function.")
  }
  if (disclaimer != exact_mandated_text) {
    reject("❌ Disclaimer modified or missing.")
  }
}
```

---

### ✅ Lock 7: No PII to External Models
**Guardian Check:**
```
if (openai_payload contains [real_name, phone, account_number, email]) {
  reject("❌ PII in model payload. Use maskPII() first.")
}
```

---

## Edge Function 6-Step Pipeline Validation

Guardian auto-checks every Edge Function:

```
Step 1 ✅ Input Validation (Zod schema)
Step 2 ✅ Legal + PII Pre-processing (maskPII, legalPreFilter)
Step 3 ✅ Model Call (with cost check)
Step 4 ✅ Post-processing (legalPostFilter, output Zod validation)
Step 5 ✅ Logging (ai_call_logs entry)
Step 6 ✅ DB Upsert (UNIQUE+UPSERT pattern)
```

Missing step → rejection.

---

## Schema Locks (Zero Flexibility)

### Bias Assessment — Q1~Q7 Immutable
| Q | Scale | Flag Threshold | Never Change |
|---|-------|---|---|
| Q1~Q3, Q5, Q7 | 5-point Likert | `x >= 4` | ✅ Locked |
| Q4 | 3-point forced | `x == 1` | ✅ Locked |
| Q6 | 5-point (reverse) | `x <= 2` | ✅ Locked |

Adding/removing/changing questions → CLAUDE.md update required first.

### Discipline Score Formula — 40/40/20
```
D = (J × 0.40) + (P × 0.40) + (E × 0.20)
```
Changing weights → CLAUDE.md update required first.

---

## How to Use INVIT Guardian

### When Creating a New Edge Function
1. Guardian auto-checks:
   - Input schema (Zod)
   - 6-step pipeline completeness
   - RLS policy on all table accesses
   - ai_call_logs entry (if model call)
   - Cost block implemented (if LLM)

2. If check fails → rejection reason + remediation

### When Modifying Data Layer
1. Guardian checks:
   - RLS policy exists
   - Matches correct tier (user-owned vs system-generated vs operational)
   - Daily records use UPSERT

2. If check fails → rejection reason

### When Generating Code
Ask Guardian explicitly:
```
"Implement generate-coaching Edge Function. 
Ensure it passes INVIT Guardian compliance checks."
```

Guardian will:
- Generate 6-step pipeline code
- Add Zod schemas for input/output
- Include cost check + fallback
- Add legal filter (post-processing)
- Log to ai_call_logs
- Use UPSERT for coaching_cards

---

## PR Review Workflow

**Before Merge:**
```
$ grep -r "openai" ./src         # Must be 0 results
$ grep -r "service_role" ./src   # Must be 0 results in app code
$ check-rls-policies.sh          # All user-owned tables must have RLS
$ verify-ai-call-logs.ts         # All model calls logged
$ verify-idempotency.ts          # Daily records = UPSERT
```

Guardian auto-rejects if any check fails.

---

## Fallback & Exception Handling

**Investment Advice Filter Fallback (Never Modify):**
```
"오늘의 원칙을 다시 확인해보세요. 일지를 작성하면 내일 새로운 코칭이 준비됩니다."
```

**Cost Block Fallback:** Same as above + auto-flag coaching_ai = false.

**Legal Disclaimer (Must Be Exact):**
> [중요 고지사항] 본 진단 결과는 귀하의 투자 행동 패턴에 대한 자기 인식을 돕기 위한 교육적 도구로서, 특정 금융투자상품에 대한 투자 권유, 매수·매도 추천, 또는 투자 적합성 판단을 목적으로 하지 않습니다. 본 서비스는 「자본시장과 금융투자업에 관한 법률」에 따른 투자자문업에 해당하지 않으며, 해당 법률에 따른 등록 투자자문업자의 서비스를 대체하지 않습니다. 진단 결과는 귀하의 행동 경향성을 참고하는 용도로만 사용하시기 바라며, 실제 투자 결정은 귀하 본인의 판단과 책임 하에 이루어져야 합니다. 투자에는 원금 손실의 위험이 있습니다. 본 진단 결과에 기반한 투자 손실에 대하여 (주)글로보더는 법적 책임을 부담하지 않습니다.

---

## When to Escalate to Jerry

**Immediate Escalation (PR Blocked Until Approval):**
1. Schema Lock conflict (Q1~Q7 changes, discipline formula change)
2. Data tier violation (mixing user-owned + operational, etc.)
3. RLS policy removal
4. New feature flag needed
5. Cost guardrail threshold change
6. Legal disclaimer modification
7. System Lock 1–7 bypass request

**All escalations require:**
- Issue title + rationale
- CLAUDE.md update proposal
- Jerry's written approval (Notion SSOT Update Log)

---

## Guardian's Promise

✅ **Consistent:** Same rules for Claude, Copilot, Codex, any model.
✅ **Predictable:** Locks published in CLAUDE.md + this AGENTS.md.
✅ **Unbreakable:** No code bypass, no special cases (except Jerry's approval).
✅ **Traceable:** Every rejection = clear reason + remediation steps.

**Trust the Guardian. The Guardian protects INVIT.**
