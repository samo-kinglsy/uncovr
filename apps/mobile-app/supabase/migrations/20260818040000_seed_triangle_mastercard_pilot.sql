begin;

do $$
begin
  if (select count(*) from public.cards where slug = 'triangle-mastercard' and name = 'Triangle Mastercard') <> 1 then
    raise exception 'Step 21B requires exactly one standard Triangle Mastercard card record';
  end if;

  if (
    select count(*)
    from public.card_versions cv
    join public.cards c on c.id = cv.card_id
    where c.slug = 'triangle-mastercard' and cv.status = 'CURRENT'
  ) <> 1 then
    raise exception 'Step 21B requires exactly one CURRENT Triangle Mastercard card version';
  end if;

  if (select count(*) from public.issuers where slug = 'canadian-tire-bank') <> 1 then
    raise exception 'Step 21B requires exactly one Canadian Tire Bank issuer';
  end if;

  if (
    select count(*)
    from public.feature_types
    where code in ('installment_financing', 'points_redemption')
  ) <> 2 then
    raise exception 'Step 21B requires installment_financing and points_redemption feature types';
  end if;
end
$$;

insert into public.evaluation_inputs (code, name, data_type, question_text, description)
values
  ('financing_plan_requested', 'Financing plan requested', 'boolean', 'Was an equal-payments financing plan requested?', 'Whether the customer requested special financing for the purchase.'),
  ('credit_approved', 'Credit approved', 'boolean', 'Was the purchase approved for the financing plan?', 'Whether required credit approval was granted.'),
  ('purchase_amount', 'Purchase amount', 'currency', 'What is the qualifying purchase amount before tax?', 'Purchase amount used to evaluate a minimum financing threshold.'),
  ('purchase_qualifies_for_financing', 'Purchase qualifies for financing', 'boolean', 'Is the purchase eligible for the financing plan?', 'Whether the purchase satisfies the applicable financing offer terms.'),
  ('merchant', 'Merchant', 'string', 'Which merchant is processing the transaction?', 'Merchant identity used for retailer eligibility.'),
  ('purchase_is_gift_card', 'Purchase is a gift card', 'boolean', 'Is the purchase for a gift card?', 'Whether the transaction includes a gift-card purchase excluded from financing.'),
  ('plan_installment_paid_in_full', 'Plan instalment paid in full', 'boolean', 'Was the monthly equal-payment plan instalment paid in full by its due date?', 'Whether the monthly equal-payment plan instalment was paid in full on time.'),
  ('minimum_payment_received', 'Minimum payment received', 'boolean', 'Was the full minimum payment received by the required date?', 'Whether the full statement minimum payment was received.'),
  ('days_since_statement', 'Days since statement', 'number', 'How many days have passed since the statement date?', 'Elapsed days used for a payment-default threshold.'),
  ('account_default_occurred', 'Account default occurred', 'boolean', 'Has another event of default occurred under the cardmember agreement?', 'Whether a non-payment event of default has occurred.'),
  ('triangle_rewards_member', 'Triangle Rewards member', 'boolean', 'Is the customer enrolled in Triangle Rewards or using an activated eligible program payment card?', 'Whether the customer has activated eligibility to redeem CT Money.'),
  ('redemption_method', 'Redemption method', 'string', 'Which eligible method will be presented to redeem CT Money?', 'Triangle Rewards card, program payment card, app, or approved cardless redemption method.'),
  ('reward_earned_on_same_transaction', 'Reward earned on same transaction', 'boolean', 'Was the CT Money being redeemed earned on this same transaction?', 'Whether a redemption attempts to use CT Money collected on the same transaction.')
on conflict (code) do nothing;

do $$
declare
  missing_inputs text;
begin
  select string_agg(required.code, ', ' order by required.code)
  into missing_inputs
  from (
    values
      ('financing_plan_requested'), ('credit_approved'), ('purchase_amount'),
      ('purchase_qualifies_for_financing'), ('merchant'), ('purchase_is_gift_card'),
      ('plan_installment_paid_in_full'), ('minimum_payment_received'),
      ('days_since_statement'), ('account_default_occurred'),
      ('triangle_rewards_member'), ('redemption_method'), ('reward_earned_on_same_transaction'),
      ('payment_method')
  ) as required(code)
  left join public.evaluation_inputs ei on ei.code = required.code
  where ei.id is null;

  if missing_inputs is not null then
    raise exception 'Step 21B missing evaluation inputs: %', missing_inputs;
  end if;
end
$$;

insert into public.source_documents (
  issuer_id, source_type, title, source_url, document_version, effective_date,
  authority_level, document_hash, retrieved_at, last_checked_at, source_status
)
select
  i.id,
  source.source_type,
  source.title,
  source.source_url,
  null,
  source.effective_date,
  source.authority_level,
  null,
  timestamptz '2026-09-13 00:00:00-04',
  timestamptz '2026-09-13 00:00:00-04',
  'VERIFIED_CURRENT'
from public.issuers i
cross join (
  values
    ('issuer_product_page', 'Triangle Mastercard — Product Page', 'https://triangle.canadiantire.ca/en/credit-cards/triangle-mastercard.html', 3, date '2025-03-26'),
    ('cardmember_terms', 'Triangle Mastercard Customers', 'https://triangle.canadiantire.ca/en/support/mastercard-customers.html', 2, null::date),
    ('financing_terms', 'Triangle Financing', 'https://triangle.canadiantire.ca/en/financing.html', 2, null::date),
    ('rewards_program_terms', 'Triangle Rewards Program Rules', 'https://triangle.canadiantire.ca/en/support/legal-and-privacy/program-rules.html', 2, null::date),
    ('issuer_product_comparison', 'Triangle Credit Card Comparison', 'https://triangle.canadiantire.ca/mastercard', 3, null::date)
) as source(source_type, title, source_url, authority_level, effective_date)
where i.slug = 'canadian-tire-bank'
  and not exists (
    select 1 from public.source_documents sd where sd.source_url = source.source_url
  );

insert into public.card_sources (card_id, source_document_id)
select c.id, sd.id
from public.cards c
join public.source_documents sd on sd.issuer_id = c.issuer_id
where c.slug = 'triangle-mastercard'
  and sd.source_url in (
    'https://triangle.canadiantire.ca/en/credit-cards/triangle-mastercard.html',
    'https://triangle.canadiantire.ca/en/support/mastercard-customers.html',
    'https://triangle.canadiantire.ca/en/financing.html',
    'https://triangle.canadiantire.ca/en/support/legal-and-privacy/program-rules.html',
    'https://triangle.canadiantire.ca/mastercard'
  )
on conflict do nothing;

insert into public.source_citations (source_document_id, page_number, section, evidence_text, verified_at)
select sd.id, null, evidence.section, evidence.evidence_text, timestamptz '2026-09-13 00:00:00-04'
from public.source_documents sd
join (
  values
    ('https://triangle.canadiantire.ca/en/credit-cards/triangle-mastercard.html', 'Additional Perks — Turn Big Purchases into Small Payments', 'No-fee, no-interest equal monthly payments are available on qualifying purchases of $150 or more with a Triangle Mastercard.'),
    ('https://triangle.canadiantire.ca/en/credit-cards/triangle-mastercard.html', 'Redeem For The Things You Love', '$1 in CT Money equals $1 in redemption value at participating Triangle retailers.'),
    ('https://triangle.canadiantire.ca/en/support/mastercard-customers.html', 'Equal payments, no interest financing', 'Standard financing is 24 months unless stated otherwise, on request and approved credit, for qualifying purchases of at least $150 with a Triangle credit card at participating retailers; gift cards are excluded.'),
    ('https://triangle.canadiantire.ca/en/support/mastercard-customers.html', 'Special payment plan conditions', 'Interest does not accrue during the plan and there is no administration fee; each monthly instalment must be paid in full by its due date.'),
    ('https://triangle.canadiantire.ca/en/support/mastercard-customers.html', 'Special payment plan default', 'Plans terminate if the full minimum due is not received within 59 days of the statement date or another applicable default occurs; outstanding balances then follow regular account terms.'),
    ('https://triangle.canadiantire.ca/en/support/legal-and-privacy/program-rules.html', 'Triangle Rewards membership', 'Collecting and redeeming CT Money requires Triangle Rewards membership; membership is for eligible individuals resident in Canada and is intended for personal and household use.'),
    ('https://triangle.canadiantire.ca/en/support/legal-and-privacy/program-rules.html', 'Redeeming CT Money', 'Redemption requires an activated membership or program payment card and presentation of an accepted card, app, or cardless method; CT Money earned on a transaction cannot be redeemed on that transaction.'),
    ('https://triangle.canadiantire.ca/mastercard', 'Our Credit Cards At A Glance', 'The standard Triangle Mastercard includes financing and redemption; insurance, roadside assistance, and concierge benefits are shown for World Elite, not the standard card.')
) as evidence(source_url, section, evidence_text) on evidence.source_url = sd.source_url
where not exists (
  select 1 from public.source_citations sc
  where sc.source_document_id = sd.id and sc.section = evidence.section
);

insert into public.card_features (
  card_version_id, feature_type_id, summary, delivery_type, provider_name,
  verification_status, risk_level, last_verified_at
)
select
  cv.id,
  ft.id,
  seed.summary,
  seed.delivery_type,
  seed.provider_name,
  'VERIFIED',
  seed.risk_level,
  timestamptz '2026-09-13 00:00:00-04'
from public.cards c
join public.card_versions cv on cv.card_id = c.id and cv.status = 'CURRENT'
cross join (
  values
    ('installment_financing', 'No-fee, no-interest equal-payment financing on qualifying purchases, subject to eligibility and account-default conditions.', 'financing', 'Canadian Tire Bank', 'MEDIUM'),
    ('points_redemption', 'Redeem CT Money at a one-to-one Canadian-dollar value within the participating Triangle retail ecosystem.', 'loyalty_redemption', 'Canadian Tire Corporation, Limited', 'LOW')
) as seed(feature_code, summary, delivery_type, provider_name, risk_level)
join public.feature_types ft on ft.code = seed.feature_code
where c.slug = 'triangle-mastercard'
  and not exists (
    select 1 from public.card_features cf
    where cf.card_version_id = cv.id and cf.feature_type_id = ft.id
  );

insert into public.feature_rules (
  card_feature_id, rule_category, rule_effect, rule_key, operator, value_json, unit,
  human_description, risk_level, verification_status
)
select
  cf.id, seed.rule_category, seed.rule_effect, seed.rule_key, seed.operator,
  seed.value_json::jsonb, seed.unit, seed.description, seed.risk_level, 'VERIFIED'
from public.cards c
join public.card_versions cv on cv.card_id = c.id and cv.status = 'CURRENT'
join public.card_features cf on cf.card_version_id = cv.id
join public.feature_types ft on ft.id = cf.feature_type_id
join (
  values
    ('installment_financing', 'eligibility', 'MUST_MATCH', 'financing_plan_requested', 'EQ', 'true', null, 'The equal-payments financing plan must be requested.', 'MEDIUM'),
    ('installment_financing', 'eligibility', 'MUST_MATCH', 'credit_approved', 'EQ', 'true', null, 'Financing is subject to approved credit.', 'MEDIUM'),
    ('installment_financing', 'payment', 'MUST_MATCH', 'triangle_card_payment', 'EQ', '"triangle_credit_card"', null, 'The qualifying purchase must be made with a Triangle credit card.', 'MEDIUM'),
    ('installment_financing', 'eligibility', 'MUST_MATCH', 'purchase_qualifies', 'EQ', 'true', null, 'The purchase must qualify for the applicable financing offer.', 'MEDIUM'),
    ('installment_financing', 'eligibility', 'MUST_MATCH', 'minimum_purchase_amount', 'GTE', '150', 'CAD', 'The standard minimum qualifying purchase is $150 before tax unless otherwise stated.', 'MEDIUM'),
    ('installment_financing', 'merchant', 'MUST_MATCH', 'participating_financing_retailer', 'IN', '["Canadian Tire", "Sport Chek", "Mark’s", "L’Équipeur", "Atmosphere", "Sports Rousseau", "Hockey Experts", "L’Entrepôt du Hockey", "participating Sports Experts"]', null, 'The purchase must be made at a participating retailer.', 'MEDIUM'),
    ('installment_financing', 'exclusion', 'MUST_NOT_MATCH', 'gift_card_purchase', 'EQ', 'true', null, 'Gift-card purchases are excluded.', 'MEDIUM'),
    ('installment_financing', 'plan_terms', 'INFORMATIONAL', 'interest_during_plan', 'EQ', '0', 'percent', 'Interest does not accrue during the qualifying plan.', 'MEDIUM'),
    ('installment_financing', 'payment', 'INFORMATIONAL', 'monthly_installment_paid', 'EQ', 'true', null, 'Each monthly plan instalment must be paid in full by its due date.', 'MEDIUM'),
    ('installment_financing', 'default', 'INFORMATIONAL', 'minimum_payment_default_threshold', 'GTE', '59', 'days', 'Special payment plans terminate when the full minimum due remains unpaid 59 days after the statement date.', 'MEDIUM'),
    ('installment_financing', 'default', 'INFORMATIONAL', 'other_account_default', 'EQ', 'true', null, 'Another applicable event of default under the cardmember agreement may terminate special payment plans.', 'MEDIUM'),
    ('installment_financing', 'default', 'INFORMATIONAL', 'post_termination_account_terms', 'EQ', 'true', null, 'After plan termination, outstanding balances become subject to applicable regular account terms.', 'MEDIUM'),
    ('points_redemption', 'eligibility', 'MUST_MATCH', 'triangle_rewards_membership', 'EQ', 'true', null, 'The customer must be enrolled in Triangle Rewards or have activated an eligible program payment card.', 'LOW'),
    ('points_redemption', 'merchant', 'MUST_MATCH', 'participating_redemption_retailer', 'IN', '["Canadian Tire", "Sport Chek", "Mark’s", "L’Équipeur", "Atmosphere", "Party City", "Pro Hockey Life", "Sports Rousseau", "Hockey Experts", "L’Entrepôt du Hockey", "participating Sports Experts"]', null, 'CT Money must be redeemed at a participating Triangle retailer.', 'LOW'),
    ('points_redemption', 'redemption', 'MUST_MATCH', 'accepted_redemption_method', 'IN', '["triangle_rewards_card", "program_payment_card", "program_app", "approved_cardless_method"]', null, 'An accepted redemption method must be presented.', 'LOW'),
    ('points_redemption', 'exclusion', 'MUST_NOT_MATCH', 'same_transaction_reward', 'EQ', 'true', null, 'CT Money earned on a purchase transaction cannot be redeemed on that same transaction.', 'LOW'),
    ('points_redemption', 'delivery', 'INFORMATIONAL', 'triangle_ecosystem_redemption', 'EQ', 'true', null, 'CT Money is redeemed within the Triangle ecosystem, not as bank cash or a statement credit.', 'LOW'),
    ('points_redemption', 'exclusion', 'INFORMATIONAL', 'redemption_exclusions_apply', 'EQ', 'true', null, 'Applicable merchant, item, and program redemption exclusions may apply.', 'LOW')
) as seed(feature_code, rule_category, rule_effect, rule_key, operator, value_json, unit, description, risk_level)
  on seed.feature_code = ft.code
where c.slug = 'triangle-mastercard'
  and not exists (
    select 1 from public.feature_rules fr
    where fr.card_feature_id = cf.id and fr.rule_key = seed.rule_key
  );

insert into public.rule_inputs (rule_id, evaluation_input_id, required)
select fr.id, ei.id, true
from public.cards c
join public.card_versions cv on cv.card_id = c.id and cv.status = 'CURRENT'
join public.card_features cf on cf.card_version_id = cv.id
join public.feature_rules fr on fr.card_feature_id = cf.id
join (
  values
    ('financing_plan_requested', 'financing_plan_requested'),
    ('credit_approved', 'credit_approved'),
    ('triangle_card_payment', 'payment_method'),
    ('purchase_qualifies', 'purchase_qualifies_for_financing'),
    ('minimum_purchase_amount', 'purchase_amount'),
    ('participating_financing_retailer', 'merchant'),
    ('gift_card_purchase', 'purchase_is_gift_card'),
    ('monthly_installment_paid', 'plan_installment_paid_in_full'),
    ('minimum_payment_default_threshold', 'days_since_statement'),
    ('minimum_payment_default_threshold', 'minimum_payment_received'),
    ('other_account_default', 'account_default_occurred'),
    ('triangle_rewards_membership', 'triangle_rewards_member'),
    ('participating_redemption_retailer', 'merchant'),
    ('accepted_redemption_method', 'redemption_method'),
    ('same_transaction_reward', 'reward_earned_on_same_transaction')
) as mapping(rule_key, input_code) on mapping.rule_key = fr.rule_key
join public.evaluation_inputs ei on ei.code = mapping.input_code
where c.slug = 'triangle-mastercard'
on conflict do nothing;

insert into public.feature_limits (
  card_feature_id, limit_type, amount, currency, quantity, unit, period, description,
  verification_status, risk_level
)
select
  cf.id, seed.limit_type, seed.amount, seed.currency, seed.quantity, seed.unit,
  seed.period, seed.description, 'VERIFIED', seed.risk_level
from public.cards c
join public.card_versions cv on cv.card_id = c.id and cv.status = 'CURRENT'
join public.card_features cf on cf.card_version_id = cv.id
join public.feature_types ft on ft.id = cf.feature_type_id
join (
  values
    ('installment_financing', 'minimum_qualifying_purchase', 150::numeric, 'CAD', null::numeric, null, 'per purchase', 'Standard minimum purchase unless otherwise stated.', 'MEDIUM'),
    ('installment_financing', 'standard_plan_duration', null, null, 24, 'months', 'per plan', 'Standard equal-payment plan duration unless otherwise stated.', 'MEDIUM'),
    ('installment_financing', 'plan_interest_rate', null, null, 0, 'percent', 'during plan', 'Interest does not accrue during the qualifying plan.', 'MEDIUM'),
    ('installment_financing', 'administration_fee', 0, 'CAD', null, null, 'per plan', 'No administration fee is charged to enter a special payment plan.', 'MEDIUM'),
    ('installment_financing', 'payment_default_threshold', null, null, 59, 'days', 'from statement date', 'Threshold after which an unpaid full minimum due terminates special payment plans.', 'MEDIUM'),
    ('points_redemption', 'redemption_value', 1, 'CAD', 1, 'CT Money', 'per redemption unit', '$1 CT Money equals $1 CAD in redemption value.', 'LOW')
) as seed(feature_code, limit_type, amount, currency, quantity, unit, period, description, risk_level)
  on seed.feature_code = ft.code
where c.slug = 'triangle-mastercard'
  and not exists (
    select 1 from public.feature_limits fl
    where fl.card_feature_id = cf.id and fl.limit_type = seed.limit_type
  );

insert into public.card_feature_citations (card_feature_id, citation_id)
select cf.id, sc.id
from public.cards c
join public.card_versions cv on cv.card_id = c.id and cv.status = 'CURRENT'
join public.card_features cf on cf.card_version_id = cv.id
join public.feature_types ft on ft.id = cf.feature_type_id
join public.source_documents sd on sd.issuer_id = c.issuer_id
join public.source_citations sc on sc.source_document_id = sd.id
join (
  values
    ('installment_financing', 'Equal payments, no interest financing'),
    ('points_redemption', 'Redeem For The Things You Love')
) as mapping(feature_code, section) on mapping.feature_code = ft.code and mapping.section = sc.section
where c.slug = 'triangle-mastercard'
on conflict do nothing;

insert into public.feature_rule_citations (rule_id, citation_id)
select fr.id, sc.id
from public.cards c
join public.card_versions cv on cv.card_id = c.id and cv.status = 'CURRENT'
join public.card_features cf on cf.card_version_id = cv.id
join public.feature_rules fr on fr.card_feature_id = cf.id
join public.source_documents sd on sd.issuer_id = c.issuer_id
join public.source_citations sc on sc.source_document_id = sd.id
join (
  values
    ('financing_plan_requested', 'Equal payments, no interest financing'),
    ('credit_approved', 'Equal payments, no interest financing'),
    ('triangle_card_payment', 'Equal payments, no interest financing'),
    ('purchase_qualifies', 'Equal payments, no interest financing'),
    ('minimum_purchase_amount', 'Equal payments, no interest financing'),
    ('participating_financing_retailer', 'Equal payments, no interest financing'),
    ('gift_card_purchase', 'Equal payments, no interest financing'),
    ('interest_during_plan', 'Special payment plan conditions'),
    ('monthly_installment_paid', 'Special payment plan conditions'),
    ('minimum_payment_default_threshold', 'Special payment plan default'),
    ('other_account_default', 'Special payment plan default'),
    ('post_termination_account_terms', 'Special payment plan default'),
    ('triangle_rewards_membership', 'Triangle Rewards membership'),
    ('participating_redemption_retailer', 'Redeeming CT Money'),
    ('accepted_redemption_method', 'Redeeming CT Money'),
    ('same_transaction_reward', 'Redeeming CT Money'),
    ('triangle_ecosystem_redemption', 'Redeem For The Things You Love'),
    ('redemption_exclusions_apply', 'Redeeming CT Money')
) as mapping(rule_key, section) on mapping.rule_key = fr.rule_key and mapping.section = sc.section
where c.slug = 'triangle-mastercard'
on conflict do nothing;

insert into public.feature_limit_citations (feature_limit_id, citation_id)
select fl.id, sc.id
from public.cards c
join public.card_versions cv on cv.card_id = c.id and cv.status = 'CURRENT'
join public.card_features cf on cf.card_version_id = cv.id
join public.feature_types ft on ft.id = cf.feature_type_id
join public.feature_limits fl on fl.card_feature_id = cf.id
join public.source_documents sd on sd.issuer_id = c.issuer_id
join public.source_citations sc on sc.source_document_id = sd.id
join (
  values
    ('installment_financing', 'minimum_qualifying_purchase', 'Equal payments, no interest financing'),
    ('installment_financing', 'standard_plan_duration', 'Equal payments, no interest financing'),
    ('installment_financing', 'plan_interest_rate', 'Special payment plan conditions'),
    ('installment_financing', 'administration_fee', 'Special payment plan conditions'),
    ('installment_financing', 'payment_default_threshold', 'Special payment plan default'),
    ('points_redemption', 'redemption_value', 'Redeem For The Things You Love')
) as mapping(feature_code, limit_type, section)
  on mapping.feature_code = ft.code and mapping.limit_type = fl.limit_type and mapping.section = sc.section
where c.slug = 'triangle-mastercard'
on conflict do nothing;

do $$
declare
  triangle_features integer;
  uncited_features integer;
  uncited_rules integer;
  uncited_limits integer;
  forbidden_features integer;
  non_triangle_features integer;
begin
  select count(*) into triangle_features
  from public.card_features cf
  join public.card_versions cv on cv.id = cf.card_version_id and cv.status = 'CURRENT'
  join public.cards c on c.id = cv.card_id
  join public.feature_types ft on ft.id = cf.feature_type_id
  where c.slug = 'triangle-mastercard'
    and ft.code in ('installment_financing', 'points_redemption');

  select count(*) into uncited_features
  from public.card_features cf
  join public.card_versions cv on cv.id = cf.card_version_id and cv.status = 'CURRENT'
  join public.cards c on c.id = cv.card_id
  join public.feature_types ft on ft.id = cf.feature_type_id
  left join public.card_feature_citations cfc on cfc.card_feature_id = cf.id
  where c.slug = 'triangle-mastercard'
    and ft.code in ('installment_financing', 'points_redemption')
    and cf.verification_status = 'VERIFIED'
    and cfc.card_feature_id is null;

  select count(*) into uncited_rules
  from public.feature_rules fr
  join public.card_features cf on cf.id = fr.card_feature_id
  join public.card_versions cv on cv.id = cf.card_version_id and cv.status = 'CURRENT'
  join public.cards c on c.id = cv.card_id
  join public.feature_types ft on ft.id = cf.feature_type_id
  left join public.feature_rule_citations frc on frc.rule_id = fr.id
  where c.slug = 'triangle-mastercard'
    and ft.code in ('installment_financing', 'points_redemption')
    and fr.verification_status = 'VERIFIED'
    and frc.rule_id is null;

  select count(*) into uncited_limits
  from public.feature_limits fl
  join public.card_features cf on cf.id = fl.card_feature_id
  join public.card_versions cv on cv.id = cf.card_version_id and cv.status = 'CURRENT'
  join public.cards c on c.id = cv.card_id
  join public.feature_types ft on ft.id = cf.feature_type_id
  left join public.feature_limit_citations flc on flc.feature_limit_id = fl.id
  where c.slug = 'triangle-mastercard'
    and ft.code in ('installment_financing', 'points_redemption')
    and fl.verification_status = 'VERIFIED'
    and flc.feature_limit_id is null;

  select count(*) into forbidden_features
  from public.card_features cf
  join public.card_versions cv on cv.id = cf.card_version_id
  join public.cards c on c.id = cv.card_id
  join public.feature_types ft on ft.id = cf.feature_type_id
  where c.slug = 'triangle-mastercard'
    and ft.code in (
      'points_earning', 'purchase_protection', 'extended_warranty',
      'rental_car_collision_damage', 'roadside_assistance', 'no_foreign_transaction_fee'
    );

  select count(*) into non_triangle_features
  from public.card_features cf
  join public.card_versions cv on cv.id = cf.card_version_id
  join public.cards c on c.id = cv.card_id
  join public.card_feature_citations cfc on cfc.card_feature_id = cf.id
  join public.source_citations sc on sc.id = cfc.citation_id
  join public.source_documents sd on sd.id = sc.source_document_id
  where sd.source_url like 'https://triangle.canadiantire.ca/%'
    and c.slug <> 'triangle-mastercard';

  if triangle_features <> 2 then
    raise exception 'Step 21B expected 2 Triangle pilot features, found %', triangle_features;
  end if;

  if uncited_features <> 0 or uncited_rules <> 0 or uncited_limits <> 0 then
    raise exception 'Step 21B citation validation failed: % features, % rules, % limits uncited',
      uncited_features, uncited_rules, uncited_limits;
  end if;

  if forbidden_features <> 0 then
    raise exception 'Step 21B found % forbidden standard Triangle Mastercard features', forbidden_features;
  end if;

  if non_triangle_features <> 0 then
    raise exception 'Step 21B linked Triangle pilot evidence to % other-card features', non_triangle_features;
  end if;
end
$$;

commit;
