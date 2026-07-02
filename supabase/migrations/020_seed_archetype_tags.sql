-- 020: principles_master archetype_tags 초기 시드
-- bias_tags JSONB에 기반해 archetype_tags text[]를 자동 계산.
-- get_principles_by_archetype() 함수가 즉시 아키타입별 결과를 반환할 수 있도록.
--
-- 아키타입 ↔ 편향 매핑 (CLAUDE.md 기준):
--   panic_reactor:       fomo, loss_aversion, herding
--   overconfident_holder: overconfidence, confirmation_bias, disposition_effect
--   theme_chaser:        fomo, herding, present_bias
--   rationalized_biased: overconfidence, confirmation_bias
--   shortterm_drifter:   present_bias, loss_aversion
-- 범용 원칙(bias_tags 없거나 'discipline', 'patience' 등): 모든 아키타입 적용

UPDATE public.principles_master
SET archetype_tags = (
  SELECT ARRAY(
    SELECT DISTINCT unnested FROM (
      VALUES
        -- panic_reactor: fomo + loss_aversion + herding 편향 원칙
        (CASE WHEN bias_tags ?| ARRAY['fomo', 'loss_aversion', 'herding']
              THEN 'panic_reactor' ELSE NULL END),
        -- overconfident_holder: overconfidence + confirmation_bias + disposition_effect
        (CASE WHEN bias_tags ?| ARRAY['overconfidence', 'confirmation_bias', 'disposition_effect']
              THEN 'overconfident_holder' ELSE NULL END),
        -- theme_chaser: fomo + herding + present_bias
        (CASE WHEN bias_tags ?| ARRAY['fomo', 'herding', 'present_bias']
              THEN 'theme_chaser' ELSE NULL END),
        -- rationalized_biased: overconfidence + confirmation_bias
        (CASE WHEN bias_tags ?| ARRAY['overconfidence', 'confirmation_bias']
              THEN 'rationalized_biased' ELSE NULL END),
        -- shortterm_drifter: present_bias + loss_aversion
        (CASE WHEN bias_tags ?| ARRAY['present_bias', 'loss_aversion']
              THEN 'shortterm_drifter' ELSE NULL END),
        -- 범용 원칙: 편향 태그가 없거나 'discipline'/'patience'/'diversification' 등
        (CASE WHEN jsonb_array_length(bias_tags) = 0
                OR bias_tags ?| ARRAY['discipline', 'patience', 'value', 'diversification', 'risk_management', 'long_term']
              THEN 'panic_reactor' ELSE NULL END),
        (CASE WHEN jsonb_array_length(bias_tags) = 0
                OR bias_tags ?| ARRAY['discipline', 'patience', 'value', 'diversification', 'risk_management', 'long_term']
              THEN 'overconfident_holder' ELSE NULL END),
        (CASE WHEN jsonb_array_length(bias_tags) = 0
                OR bias_tags ?| ARRAY['discipline', 'patience', 'value', 'diversification', 'risk_management', 'long_term']
              THEN 'theme_chaser' ELSE NULL END),
        (CASE WHEN jsonb_array_length(bias_tags) = 0
                OR bias_tags ?| ARRAY['discipline', 'patience', 'value', 'diversification', 'risk_management', 'long_term']
              THEN 'rationalized_biased' ELSE NULL END),
        (CASE WHEN jsonb_array_length(bias_tags) = 0
                OR bias_tags ?| ARRAY['discipline', 'patience', 'value', 'diversification', 'risk_management', 'long_term']
              THEN 'shortterm_drifter' ELSE NULL END)
    ) AS t(unnested)
    WHERE unnested IS NOT NULL
  )
)
WHERE is_active = TRUE;

DO $$
DECLARE
  total_count INTEGER;
  tagged_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM public.principles_master WHERE is_active = TRUE;
  SELECT COUNT(*) INTO tagged_count FROM public.principles_master WHERE is_active = TRUE AND cardinality(archetype_tags) > 0;
  RAISE NOTICE '020 완료: % / % 원칙에 archetype_tags 설정됨', tagged_count, total_count;
END $$;
