---
description: INVIT 5-Role Hybrid Architecture Guidelines
---

# INVIT Claude Code 5-Role Hybrid Architecture

> This document enforces the architecture, rules, and Agent workflows specifically for INVIT building tasks according to `CLAUDE.md`. 
> All Agent interactions should inherently respect these Roles.

## 1. ORCHESTRATOR (Lead Session)
- **Role**: You (the main AI assistant instance).
- **Instruction**: 
  - Always maintain the entire context of `CLAUDE.md` and LOCKs.
  - Distribute Sprint tasks and manage Gates.
  - Do not skip the sequence: `Explorer → Spec-Guard → Implementer → Verifier`.
  - Approve PRs and transitions only when the Gate requirements are satisfied.

## 2. Spec-Guard
- **Role**: Read-only validation phase.
- **Instruction**:
  - Determine if the requested implementation violates a `CLAUDE.md` LOCK.
  - Output either: `{허용 | 금지 | 설계 확정 필요}`.
  - If "금지" or "설계 확정 필요", STOP and block Implementer until resolved.
  - Deliver LOCK parameters (`fomo-thresholds`, etc.) to the Implementer exactly as specified.

## 3. DB Implementer
- **Role**: Write capability restricted to `supabase/migrations/*` and `src/types/database.ts`.
- **Instruction**:
  - EVERY table MUST have `ENABLE ROW LEVEL SECURITY`.
  - Daily records (`discipline_logs`, `fomo_alerts`, `coaching_cards`) MUST use `UNIQUE` + `ON CONFLICT DO UPDATE`.
  - Goal: Pass `supabase gen types typescript` with zero errors.

## 4. Edge Function Implementer
- **Role**: Write capability restricted to `supabase/functions/*` (Deno).
- **Instruction**:
  - NO DIRECT OpenAI CALLS FROM THE CLIENT EVER.
  - Must write the 6-Step Pipeline explicitly limit checks, legal filtering, AI, logging (`ai_call_logs`), and DB upserts.
  - Prevent PR creation if `ai_call_logs` step is missing.

## 5. RN Implementer 
- **Role**: Write capability restricted to `src/components/*`, `src/screens/*`, `src/constants/*`, `App.tsx`.
- **Instruction**:
  - Direct DB Access is exclusively restricted to `SELECT` (Read). `INSERT`/`UPDATE` MUST invoke Edge Functions.
  - Extract Color Tokens and constants early.
  - Build Fallback UI *first* before wiring the Edge Function calls.

## 6. Verifier/QA
- **Role**: Code validation, typechecking, and security reviews.
- **Instruction**:
  - Cannot rewrite code directly; only proposes patches.
  - Run type checks, lint checks, and review RLS logic before PR merges.
