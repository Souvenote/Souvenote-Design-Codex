INSERT INTO pricing_catalog (
    offer_code,
    name,
    offer_type,
    price_cents,
    currency,
    card_count_min,
    card_count_max,
    credits_per_card,
    shipping_included,
    metadata
)
VALUES
(
    'try_risk_free_one_card',
    'Try Risk-Free',
    'try_risk_free',
    999,
    'cad',
    1,
    1,
    10,
    TRUE,
    '{"hold_days": 5, "decision_window_starts_at": "payment_authorized", "no_action_result": "charge_no_send_fee", "no_send_fee_cents": 200}'::jsonb
),
(
    'big_sender_2_10',
    'Big Sender 2-10 Cards',
    'big_sender',
    899,
    'cad',
    2,
    10,
    10,
    TRUE,
    '{}'::jsonb
),
(
    'big_sender_11_20',
    'Big Sender 11-20 Cards',
    'big_sender',
    799,
    'cad',
    11,
    20,
    10,
    TRUE,
    '{}'::jsonb
),
(
    'big_sender_21_30',
    'Big Sender 21-30 Cards',
    'big_sender',
    699,
    'cad',
    21,
    30,
    10,
    TRUE,
    '{}'::jsonb
),
(
    'credit_pack_starter_10',
    'Starter Credits',
    'credit_pack',
    200,
    'cad',
    0,
    0,
    10,
    FALSE,
    '{"credit_amount": 10, "blurb": "Top off a short session.", "accent": "platinum"}'::jsonb
),
(
    'credit_pack_creator_80',
    'Creator Credits',
    'credit_pack',
    1000,
    'cad',
    0,
    0,
    80,
    FALSE,
    '{"credit_amount": 80, "blurb": "A full evening of iteration.", "accent": "gold", "featured": true, "badge": "Most popular"}'::jsonb
),
(
    'credit_pack_power_250',
    'Power Credits',
    'credit_pack',
    2500,
    'cad',
    0,
    0,
    250,
    FALSE,
    '{"credit_amount": 250, "blurb": "For repeat senders and remixers.", "accent": "rose"}'::jsonb
)
ON CONFLICT (offer_code) DO UPDATE
SET
    name = EXCLUDED.name,
    offer_type = EXCLUDED.offer_type,
    price_cents = EXCLUDED.price_cents,
    currency = EXCLUDED.currency,
    card_count_min = EXCLUDED.card_count_min,
    card_count_max = EXCLUDED.card_count_max,
    credits_per_card = EXCLUDED.credits_per_card,
    shipping_included = EXCLUDED.shipping_included,
    metadata = EXCLUDED.metadata,
    is_active = TRUE,
    updated_at = NOW();
