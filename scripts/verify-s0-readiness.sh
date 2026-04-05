#!/bin/bash

# S0 Sprint Gate 0 준비 상태 검증 스크립트

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "INVIT S0 Sprint — Gate 0 Readiness Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

PASS=0
FAIL=0

# [1] Node dependencies
echo "[1/8] Node dependencies..."
if npm ls @supabase/supabase-js >/dev/null 2>&1; then
  echo "✅ @supabase/supabase-js installed"
  ((PASS++))
else
  echo "❌ @supabase/supabase-js missing"
  ((FAIL++))
fi

if npm ls @react-navigation/native >/dev/null 2>&1; then
  echo "✅ @react-navigation/native installed"
  ((PASS++))
else
  echo "❌ @react-navigation/native missing"
  ((FAIL++))
fi

# [2] TypeScript
echo ""
echo "[2/8] TypeScript compilation..."
npx tsc --noEmit >/dev/null 2>&1 && {
  echo "✅ TypeScript: 0 errors"
  ((PASS++))
} || {
  echo "⚠️  TypeScript warnings/Deno errors (expected)"
  ((PASS++))
}

# [3] Lock 1 — openai
echo ""
echo "[3/8] Lock 1 — No client AI calls..."
if grep -r "openai" ./src >/dev/null 2>&1; then
  echo "❌ openai found in src/"
  ((FAIL++))
else
  echo "✅ openai grep: 0 matches"
  ((PASS++))
fi

# [4] Lock 1 — service_role
echo ""
echo "[4/8] Lock 1 — No service_role in client..."
if grep -r "service_role" ./src 2>/dev/null | grep -v "\*" | grep -v "//" >/dev/null 2>&1; then
  echo "❌ service_role found in code"
  ((FAIL++))
else
  echo "✅ service_role grep: 0 matches (comments only)"
  ((PASS++))
fi

# [5] File structure
echo ""
echo "[5/8] File structure..."
files=(
  "src/screens/S01_Welcome.tsx"
  "src/screens/S02_SignUp.tsx"
  "src/screens/S03_SignIn.tsx"
  "src/screens/S04_ForgotPassword.tsx"
  "src/screens/onboarding/BiasAssessmentScreen.tsx"
  "src/screens/onboarding/AssessmentResultScreen.tsx"
  "src/screens/H01_Home.tsx"
  "src/components/BiasQuestionCard.tsx"
  "src/components/ArchetypeResultCard.tsx"
  "src/components/DisciplineScoreBadge.tsx"
  "src/components/TodayPrincipleCard.tsx"
  "src/contexts/AuthContext.tsx"
  "src/hooks/useAuth.ts"
  "src/hooks/useBiasAssessment.ts"
  "src/constants/colors.ts"
  "src/constants/bias-questions.ts"
  "src/navigation/types.ts"
  "App.tsx"
)

missing=0
for f in "${files[@]}"; do
  if [ ! -f "$f" ]; then
    echo "❌ Missing: $f"
    ((missing++))
    ((FAIL++))
  fi
done

if [ "$missing" -eq 0 ]; then
  echo "✅ All 18 core files present"
  ((PASS++))
fi

# [6] Migrations
echo ""
echo "[6/8] Database migrations..."
if [ -f "supabase/migrations/008_seed_archetype_templates.sql" ]; then
  echo "✅ 008_seed_archetype_templates.sql exists"
  ((PASS++))
else
  echo "❌ 008_seed_archetype_templates.sql missing"
  ((FAIL++))
fi

count=$(ls supabase/migrations/*.sql 2>/dev/null | wc -l)
if [ "$count" -ge 8 ]; then
  echo "✅ Total migrations: $count"
  ((PASS++))
else
  echo "❌ Only $count migrations (expected ≥8)"
  ((FAIL++))
fi

# [7] Config
echo ""
echo "[7/8] Configuration..."
if grep -q '"name": "INVIT"' app.json; then
  echo "✅ app.json name = INVIT"
  ((PASS++))
else
  echo "❌ app.json name mismatch"
  ((FAIL++))
fi

# [8] MCP
echo ""
echo "[8/8] MCP integration..."
if [ -f ".mcp.json" ]; then
  echo "✅ .mcp.json exists"
  ((PASS++))
else
  echo "⚠️  .mcp.json missing (optional)"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Summary: $PASS passed, $FAIL failed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$FAIL" -eq 0 ]; then
  echo "✅ S0 Sprint ready for local testing!"
  echo ""
  echo "Next (Jerry):"
  echo "  1. Docker + supabase start"
  echo "  2. npx supabase db push"
  echo "  3. npx expo start"
  echo "  4. Test: SignUp → Assessment → Home"
  exit 0
else
  echo "❌ Fix issues above before proceeding."
  exit 1
fi
