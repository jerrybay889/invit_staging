-- 021: archetype_tags 한국어 태그명으로 재시드 (020 교정)
-- 실제 bias_tags 저장값이 한국어('FOMO·군집','손실회피' 등)임을 확인 후 재작성.
-- 020 마이그레이션은 영문 태그로 0건 업데이트됨 → 이 마이그레이션으로 교체.
--
-- 태그값 ↔ 아키타입 매핑:
--   FOMO·군집      → panic_reactor, theme_chaser
--   손실회피       → panic_reactor, shortterm_drifter
--   후회회피       → panic_reactor, shortterm_drifter
--   과잉확신       → overconfident_holder, rationalized_biased
--   확증           → overconfident_holder, rationalized_biased
--   처분효과       → overconfident_holder, rationalized_biased
--   닻             → overconfident_holder, rationalized_biased
--   단기주의       → theme_chaser, shortterm_drifter
--   (빈 배열)      → 전 아키타입 (범용)

UPDATE public.principles_master
SET archetype_tags = (
  SELECT ARRAY(
    SELECT DISTINCT unnested FROM (
      VALUES
        (CASE WHEN bias_tags ?| ARRAY['FOMO·군집','손실회피','후회회피']
              THEN 'panic_reactor' ELSE NULL END),
        (CASE WHEN bias_tags ?| ARRAY['과잉확신','확증','처분효과','닻']
              THEN 'overconfident_holder' ELSE NULL END),
        (CASE WHEN bias_tags ?| ARRAY['FOMO·군집','단기주의']
              THEN 'theme_chaser' ELSE NULL END),
        (CASE WHEN bias_tags ?| ARRAY['과잉확신','확증','처분효과','닻']
              THEN 'rationalized_biased' ELSE NULL END),
        (CASE WHEN bias_tags ?| ARRAY['단기주의','손실회피','후회회피']
              THEN 'shortterm_drifter' ELSE NULL END),
        (CASE WHEN jsonb_array_length(bias_tags) = 0 THEN 'panic_reactor'        ELSE NULL END),
        (CASE WHEN jsonb_array_length(bias_tags) = 0 THEN 'overconfident_holder' ELSE NULL END),
        (CASE WHEN jsonb_array_length(bias_tags) = 0 THEN 'theme_chaser'         ELSE NULL END),
        (CASE WHEN jsonb_array_length(bias_tags) = 0 THEN 'rationalized_biased'  ELSE NULL END),
        (CASE WHEN jsonb_array_length(bias_tags) = 0 THEN 'shortterm_drifter'    ELSE NULL END)
    ) AS t(unnested)
    WHERE unnested IS NOT NULL
  )
)
WHERE is_active = TRUE;
