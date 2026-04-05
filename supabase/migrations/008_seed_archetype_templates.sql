-- 008: Seed archetype_templates with initial coaching templates
-- 6 archetypes × 3 categories = 18 templates (MVP baseline)

INSERT INTO public.archetype_templates (archetype, category, content) VALUES
-- panic_reactor
('panic_reactor', 'daily_nudge', '시장 변동은 자연스러운 현상입니다. 오늘의 원칙을 먼저 확인하고, 감정이 아닌 계획에 따라 행동하세요.'),
('panic_reactor', 'fomo_response', '급등락에 반응하고 싶은 충동이 느껴지나요? 지금은 멈추고 심호흡하세요. 당신의 원칙이 가장 좋은 가이드입니다.'),
('panic_reactor', 'principle_reminder', '매매 전 반드시 원칙 일지를 확인하세요. 충동적 결정의 6개월 후 결과를 떠올려 보세요.'),

-- overconfident_holder
('overconfident_holder', 'daily_nudge', '오늘 보유 종목을 객관적으로 점검해보세요. 처음 매수 이유가 아직 유효한가요?'),
('overconfident_holder', 'fomo_response', '확신이 강할수록 반대 근거를 찾아보세요. 내가 틀릴 수 있는 시나리오는 무엇인가요?'),
('overconfident_holder', 'principle_reminder', '손절 기준을 미리 정하고 기록하세요. 감정이 아닌 숫자로 판단하세요.'),

-- theme_chaser
('theme_chaser', 'daily_nudge', '오늘 관심 가는 종목이 있다면, 그 이유가 분석인지 분위기인지 구분해보세요.'),
('theme_chaser', 'fomo_response', '모두가 사고 있다는 느낌이 드나요? 군중과 반대로 가는 것이 더 나은 결과를 가져올 수 있습니다.'),
('theme_chaser', 'principle_reminder', '테마주 매수 전 최소 3일 관찰 원칙을 지키고 있나요? 급할수록 천천히.'),

-- rationalized_biased
('rationalized_biased', 'daily_nudge', '오늘의 투자 판단에 감정이 섞여 있지 않은지 점검해보세요. 논리적 포장 속 감정을 찾아보세요.'),
('rationalized_biased', 'fomo_response', '매수 이유를 글로 적어보세요. 적고 나서 읽어보면 감정과 논리가 구분됩니다.'),
('rationalized_biased', 'principle_reminder', '확증 편향 체크: 내 판단과 반대되는 정보를 오늘 하나 이상 찾아보셨나요?'),

-- shortterm_drifter
('shortterm_drifter', 'daily_nudge', '단기 변동에 흔들리지 마세요. 당신의 투자 기간은 며칠이 아니라 몇 년입니다.'),
('shortterm_drifter', 'fomo_response', '지금 매매하려는 이유가 장기 계획에 부합하나요? 단기 충동이라면 내일 다시 생각해보세요.'),
('shortterm_drifter', 'principle_reminder', '원칙 일지를 꾸준히 작성하는 것이 수익률보다 중요합니다. 오늘도 기록하세요.'),

-- mixed
('mixed', 'daily_nudge', '오늘 하루 투자 결정을 내리기 전에, 잠시 멈추고 원칙을 확인하세요.'),
('mixed', 'fomo_response', '시장 뉴스에 반응하기 전에 원칙 일지를 먼저 열어보세요. 기록이 최선의 방어입니다.'),
('mixed', 'principle_reminder', '매일 원칙을 확인하고 일지를 작성하는 습관이 가장 강력한 투자 도구입니다.')

ON CONFLICT DO NOTHING;
