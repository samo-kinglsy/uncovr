begin;

do $$
begin
  if (select count(*) from public.cards where slug = 'rbc-avion-visa-infinite') <> 1 then
    raise exception 'Step 21A requires exactly one cards row for rbc-avion-visa-infinite';
  end if;

  if (
    select count(*)
    from public.card_versions cv
    join public.cards c on c.id = cv.card_id
    where c.slug = 'rbc-avion-visa-infinite' and cv.status = 'CURRENT'
  ) <> 1 then
    raise exception 'Step 21A requires exactly one CURRENT RBC Avion Visa Infinite card version';
  end if;

  if (select count(*) from public.issuers where slug = 'rbc') <> 1 then
    raise exception 'Step 21A requires exactly one issuer with slug rbc';
  end if;
end
$$;

insert into public.feature_types (category_id, code, name, description)
values
  (
    (select id from public.benefit_categories where code = 'insurance'),
    'travel_accident',
    'Travel accident',
    'Accidental death and dismemberment coverage while travelling on a covered common carrier.'
  ),
  (
    (select id from public.benefit_categories where code = 'insurance'),
    'hotel_motel_burglary',
    'Hotel/motel burglary',
    'Coverage for eligible personal property lost or damaged by burglary of covered accommodation.'
  )
on conflict (code) do nothing;

insert into public.evaluation_inputs (code, name, data_type, question_text, description)
values
  ('trip_duration_days', 'Trip duration', 'number', 'How many consecutive days is the trip?', 'Number of consecutive days in the trip.'),
  ('canadian_resident', 'Canadian resident', 'boolean', 'Is the insured person a permanent resident of Canada?', 'Whether the insured person satisfies the policy definition of permanent resident.'),
  ('government_health_plan_active', 'Government health plan active', 'boolean', 'Does the insured person have an active provincial or territorial government health plan?', 'Whether required government health insurance coverage is valid.'),
  ('insured_person_relationship', 'Insured person relationship', 'string', 'What is the insured person’s relationship to the primary cardholder?', 'Policy role or relationship used to determine covered-person status.'),
  ('payment_percentage', 'Eligible payment percentage', 'number', 'What percentage of the eligible cost was paid with the card and/or its rewards points?', 'Percentage of a rental, fare, trip, item, or device cost paid using an eligible card and/or rewards points.'),
  ('account_in_good_standing', 'Account in good standing', 'boolean', 'Is the card account open and in good standing?', 'Whether the card account is open and not past due beyond the policy threshold.'),
  ('rental_agency_cdw_declined', 'Rental agency CDW declined', 'boolean', 'Was the rental agency collision/loss damage waiver declined?', 'Whether optional collision/loss damage coverage offered by the rental agency was declined.'),
  ('authorized_rental_driver', 'Authorized rental driver', 'boolean', 'Is the driver licensed and permitted under the rental agreement?', 'Whether a driver is licensed and authorized under the rental agreement and local law.'),
  ('air_carrier_check_in_completed', 'Air-carrier check-in completed', 'boolean', 'Has the traveller checked in with the air carrier?', 'Whether required air-carrier check-in has been completed.'),
  ('delay_duration_hours', 'Delay duration', 'number', 'How many hours has the delay lasted?', 'Elapsed hours for a baggage, flight, or connection delay.'),
  ('wireless_bill_charged_to_card', 'Wireless bill charged to card', 'boolean', 'Are all monthly wireless-plan payments charged to the card?', 'Whether monthly wireless bills are continuously charged to the card for a financed device.')
on conflict (code) do nothing;

do $$
declare
  missing_codes text;
begin
  select string_agg(required.code, ', ' order by required.code)
  into missing_codes
  from (
    values
      ('travel_emergency_medical'), ('travel_accident'), ('rental_car_collision_damage'),
      ('trip_cancellation'), ('trip_interruption'), ('baggage_delay'), ('flight_delay'),
      ('hotel_motel_burglary'), ('purchase_protection'), ('extended_warranty'),
      ('mobile_device_insurance')
  ) as required(code)
  left join public.feature_types ft on ft.code = required.code
  where ft.id is null;

  if missing_codes is not null then
    raise exception 'Step 21A missing feature types: %', missing_codes;
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
  null,
  source.authority_level,
  source.document_hash,
  timestamptz '2026-09-13 00:00:00-04',
  timestamptz '2026-09-13 00:00:00-04',
  'VERIFIED_CURRENT'
from public.issuers i
cross join (
  values
    (
      'insurance_certificate',
      'RBC Avion Visa Infinite — Certificate of Insurance',
      'https://www.rbcroyalbank.com/credit-cards/travel/rbc-visa-infinite-avion/rbc-visa-infinite-avion-certificate-of-insurance.pdf',
      1,
      'df4205b14fd19832b24b255a0b2e4514fedcc2c5a830f89577e33aa2525d8139'
    ),
    (
      'benefit_guide',
      'Your RBC Avion Visa Infinite — Benefits Guide',
      'https://www.rbcroyalbank.com/credit-cards/travel/rbc-visa-infinite-avion/rbc-visa-infinite-avion-benefits-guide.pdf',
      2,
      '47696391ea0618da2f8425a54efdf0aa6af7b4c23832fbde54a20c4319bff76e'
    ),
    (
      'insurance_product_summary',
      'RBC Avion Visa Infinite — Insurance Product Summary',
      'https://www.rbcroyalbank.com/credit-cards/cardholders/additional-documents/rbc-avion-visa-infinite-quebecforms.pdf',
      2,
      'f2ed432bb09787897d4d08bd5c17b19b8f5df53ed53ef04232bc763a3e786162'
    )
) as source(source_type, title, source_url, authority_level, document_hash)
where i.slug = 'rbc'
  and not exists (
    select 1 from public.source_documents sd where sd.source_url = source.source_url
  );

insert into public.card_sources (card_id, source_document_id)
select c.id, sd.id
from public.cards c
join public.source_documents sd on sd.issuer_id = c.issuer_id
where c.slug = 'rbc-avion-visa-infinite'
  and sd.source_url in (
    'https://www.rbcroyalbank.com/credit-cards/travel/rbc-visa-infinite-avion/rbc-visa-infinite-avion-certificate-of-insurance.pdf',
    'https://www.rbcroyalbank.com/credit-cards/travel/rbc-visa-infinite-avion/rbc-visa-infinite-avion-benefits-guide.pdf',
    'https://www.rbcroyalbank.com/credit-cards/cardholders/additional-documents/rbc-avion-visa-infinite-quebecforms.pdf'
  )
on conflict do nothing;

insert into public.source_citations (source_document_id, page_number, section, evidence_text, verified_at)
select sd.id, evidence.page_number, evidence.section, evidence.evidence_text, timestamptz '2026-09-13 00:00:00-04'
from public.source_documents sd
cross join (
  values
    (2, 'Emergency Medical — covered persons', 'Covered persons must have a valid government health plan and be permanent residents of Canada.'),
    (4, 'Emergency Medical — coverage duration', 'Coverage applies for 15 consecutive trip days when under 65 and 3 consecutive trip days when age 65 or older.'),
    (5, 'Emergency Medical — maximum benefit', 'Unless otherwise noted, the maximum emergency medical insurance benefit is unlimited.'),
    (12, 'Travel Accident — eligibility and specific loss indemnity', 'The full common-carrier fare must be paid with the card and/or Avion points; listed specific-loss indemnities reach $500,000.'),
    (16, 'Auto Rental — eligibility summary', 'The entire rental cost must be paid with the card and/or Avion points; the rental period must not exceed 48 consecutive days.'),
    (18, 'Auto Rental — authorized drivers', 'Drivers must qualify under the rental agreement, be legally licensed, and be permitted to operate the vehicle where it is used.'),
    (19, 'Auto Rental — coverage conditions', 'Coverage requires full eligible payment and declining the rental agency CDW; covered loss is limited to actual cash value.'),
    (21, 'Auto Rental — vehicle exclusions', 'Vehicles with model-year MSRP over $65,000 CAD and listed vehicle classes are excluded.'),
    (24, 'Trip Cancellation and Interruption — limits', 'Trip cancellation is limited to $1,500 per covered person per trip and $5,000 overall; interruption is $5,000 per person and $25,000 overall.'),
    (26, 'Trip Cancellation and Interruption — coverage', 'Coverage applies to non-refundable prepaid travel arrangements for covered reasons, subject to the certificate conditions.'),
    (32, 'Delayed Baggage — eligibility and timing', 'The full airline-ticket cost must be paid with the card and/or Avion points; coverage begins after a four-hour baggage delay.'),
    (33, 'Flight Delay — eligibility and timing', 'The full airline-ticket cost must be paid with the card and/or Avion points, check-in is required, and coverage begins after four hours.'),
    (33, 'Delayed Baggage and Flight Delay — limits', 'Baggage delay pays up to $500 per occurrence and $2,500 overall; flight delay pays up to $250 daily and $500 overall per occurrence.'),
    (35, 'Hotel/Motel Burglary — coverage', 'Forced-entry burglary of a hotel room, motel room, or cruise cabin is covered up to $2,500 total per occurrence.'),
    (39, 'Purchase Security — coverage and limits', 'Eligible items paid in full with the card and/or Avion points are covered for 90 days, up to $50,000 per account per calendar year.'),
    (39, 'Extended Warranty — coverage and limits', 'Eligible fully paid items receive up to one additional warranty year; original and extended coverage cannot exceed five years.'),
    (43, 'Mobile Device — eligibility and duration', 'Eligible devices require full payment or continuous monthly wireless-plan billing to the card and are covered for two years from purchase.'),
    (44, 'Mobile Device — benefit and frequency limits', 'Reimbursement is limited to $1,500 per claim, one claim per 12 months, and two claims per 48 months.'),
    (44, 'Mobile Device — depreciation and deductible', 'A 2% depreciation applies per completed month, followed by a 10% deductible on the calculated depreciated value.')
) as evidence(page_number, section, evidence_text)
where sd.source_url = 'https://www.rbcroyalbank.com/credit-cards/travel/rbc-visa-infinite-avion/rbc-visa-infinite-avion-certificate-of-insurance.pdf'
  and not exists (
    select 1
    from public.source_citations sc
    where sc.source_document_id = sd.id
      and sc.page_number = evidence.page_number
      and sc.section = evidence.section
  );

insert into public.card_features (
  card_version_id, feature_type_id, summary, delivery_type, provider_name, insurer_name,
  verification_status, risk_level, last_verified_at
)
select
  cv.id,
  ft.id,
  seed.summary,
  'included_insurance',
  'Allianz Global Assistance',
  seed.insurer_name,
  'VERIFIED',
  'HIGH',
  timestamptz '2026-09-13 00:00:00-04'
from public.cards c
join public.card_versions cv on cv.card_id = c.id and cv.status = 'CURRENT'
cross join (
  values
    ('travel_emergency_medical', 'Emergency medical coverage while outside the insured person’s Canadian province or territory of residence.', 'RBC Insurance Company of Canada'),
    ('travel_accident', 'Accidental death and dismemberment coverage while travelling on an eligible common carrier.', 'RBC Insurance Company of Canada'),
    ('rental_car_collision_damage', 'Collision and loss damage waiver insurance for eligible rental vehicles.', 'Aviva General Insurance Company'),
    ('trip_cancellation', 'Coverage for eligible non-refundable prepaid travel arrangements when a covered reason causes cancellation.', 'RBC Insurance Company of Canada'),
    ('trip_interruption', 'Coverage for eligible costs when a covered reason interrupts or delays a trip.', 'RBC Insurance Company of Canada'),
    ('baggage_delay', 'Reimbursement for essential emergency purchases after an eligible checked-baggage delay.', 'RBC Insurance Company of Canada'),
    ('flight_delay', 'Reimbursement for eligible expenses after a covered flight delay, missed connection, or denied boarding.', 'RBC Insurance Company of Canada'),
    ('hotel_motel_burglary', 'Coverage for eligible personal property lost or damaged by forced-entry burglary of covered accommodation.', 'RBC Insurance Company of Canada'),
    ('purchase_protection', 'Loss or accidental physical damage coverage for eligible newly purchased items.', 'RBC Insurance Company of Canada'),
    ('extended_warranty', 'Extension of an eligible item’s original manufacturer warranty.', 'RBC Insurance Company of Canada'),
    ('mobile_device_insurance', 'Coverage for accidental loss, damage, or mechanical failure of an eligible mobile device.', 'RBC Insurance Company of Canada')
) as seed(feature_code, summary, insurer_name)
join public.feature_types ft on ft.code = seed.feature_code
where c.slug = 'rbc-avion-visa-infinite'
  and not exists (
    select 1 from public.card_features cf
    where cf.card_version_id = cv.id and cf.feature_type_id = ft.id
  );

insert into public.feature_rules (
  card_feature_id, rule_category, rule_effect, rule_key, operator, value_json, unit,
  human_description, risk_level, verification_status
)
select cf.id, seed.rule_category, seed.rule_effect, seed.rule_key, seed.operator,
  seed.value_json::jsonb, seed.unit, seed.description, 'HIGH', 'VERIFIED'
from public.cards c
join public.card_versions cv on cv.card_id = c.id and cv.status = 'CURRENT'
join public.card_features cf on cf.card_version_id = cv.id
join public.feature_types ft on ft.id = cf.feature_type_id
join (
  values
    ('travel_emergency_medical', 'eligibility', 'MUST_MATCH', 'canadian_resident', 'EQ', 'true', null, 'The insured person must be a permanent resident of Canada.'),
    ('travel_emergency_medical', 'eligibility', 'MUST_MATCH', 'government_health_plan_active', 'EQ', 'true', null, 'The insured person must have a valid government health insurance plan.'),
    ('travel_emergency_medical', 'duration', 'MUST_MATCH', 'age_under_65', 'LT', '65', 'years', 'For the 15-day coverage branch, the insured person must be under age 65.'),
    ('travel_emergency_medical', 'duration', 'MUST_MATCH', 'trip_days_under_65', 'LTE', '15', 'days', 'When under 65, coverage applies to the first 15 consecutive trip days.'),
    ('travel_emergency_medical', 'duration', 'MUST_MATCH', 'age_65_or_older', 'GTE', '65', 'years', 'For the 3-day coverage branch, the insured person must be age 65 or older.'),
    ('travel_emergency_medical', 'duration', 'MUST_MATCH', 'trip_days_65_or_older', 'LTE', '3', 'days', 'When age 65 or older, coverage applies to the first 3 consecutive trip days.'),
    ('travel_accident', 'eligibility', 'MUST_MATCH', 'covered_person_relationship', 'IN', '["applicant", "applicant_spouse", "applicant_dependent_child", "additional_cardholder"]', null, 'The insured person must satisfy one of the certificate’s covered-person relationships.'),
    ('travel_accident', 'payment', 'MUST_MATCH', 'common_carrier_fare_payment_percentage', 'EQ', '100', 'percent', 'The full common-carrier transportation fare must be paid with the card and/or Avion points.'),
    ('rental_car_collision_damage', 'payment', 'MUST_MATCH', 'rental_payment_percentage', 'EQ', '100', 'percent', 'The entire rental cost must be paid with the card and/or Avion points.'),
    ('rental_car_collision_damage', 'duration', 'MUST_MATCH', 'rental_duration', 'LTE', '48', 'days', 'The rental coverage period must not exceed 48 consecutive days.'),
    ('rental_car_collision_damage', 'eligibility', 'MUST_MATCH', 'rental_cdw_declined', 'EQ', 'true', null, 'The rental agency collision/loss damage waiver must be declined for full primary coverage.'),
    ('rental_car_collision_damage', 'eligibility', 'MUST_MATCH', 'rental_driver_authorized', 'EQ', 'true', null, 'Drivers must be licensed and permitted under the rental agreement and local law.'),
    ('rental_car_collision_damage', 'exclusion', 'MUST_NOT_MATCH', 'rental_vehicle_msrp_over_limit', 'GT', '65000', 'CAD', 'Vehicles with model-year MSRP over $65,000 CAD are excluded.'),
    ('trip_cancellation', 'payment', 'MUST_MATCH', 'trip_payment_percentage', 'EQ', '100', 'percent', 'Covered prepaid travel arrangements must be paid with the card and/or Avion points as specified by the certificate.'),
    ('trip_interruption', 'payment', 'MUST_MATCH', 'trip_payment_percentage', 'EQ', '100', 'percent', 'Covered prepaid travel arrangements must be paid with the card and/or Avion points as specified by the certificate.'),
    ('baggage_delay', 'payment', 'MUST_MATCH', 'air_ticket_payment_percentage', 'EQ', '100', 'percent', 'The full airline-ticket cost must be paid with the card and/or Avion points.'),
    ('baggage_delay', 'waiting_period', 'MUST_MATCH', 'baggage_delay_hours', 'GTE', '4', 'hours', 'Checked baggage must be delayed at least four hours.'),
    ('flight_delay', 'payment', 'MUST_MATCH', 'air_ticket_payment_percentage', 'EQ', '100', 'percent', 'The full airline-ticket cost must be paid with the card and/or Avion points.'),
    ('flight_delay', 'eligibility', 'MUST_MATCH', 'air_carrier_check_in', 'EQ', 'true', null, 'The insured person must have checked in with the air carrier.'),
    ('flight_delay', 'waiting_period', 'MUST_MATCH', 'flight_delay_hours', 'GTE', '4', 'hours', 'The qualifying delay must last at least four hours.'),
    ('hotel_motel_burglary', 'cause', 'MUST_MATCH', 'forced_entry_burglary', 'EQ', '"forced_entry_burglary"', null, 'Burglary must involve wrongful entry with visible signs of force.'),
    ('purchase_protection', 'payment', 'MUST_MATCH', 'item_payment_percentage', 'EQ', '100', 'percent', 'The insured item must be paid in full with the card and/or Avion points.'),
    ('purchase_protection', 'coverage_window', 'MUST_MATCH', 'days_since_purchase', 'WITHIN_LAST', '90', 'days', 'Purchase Security applies for 90 days from purchase.'),
    ('extended_warranty', 'payment', 'MUST_MATCH', 'item_payment_percentage', 'EQ', '100', 'percent', 'The insured item must be paid in full with the card and/or Avion points.'),
    ('mobile_device_insurance', 'payment', 'MUST_MATCH', 'device_payment_percentage', 'EQ', '100', 'percent', 'An outright device purchase must be paid in full with the card and/or Avion points.'),
    ('mobile_device_insurance', 'payment', 'MUST_MATCH', 'wireless_bill_payment', 'EQ', 'true', null, 'For a device financed through a plan, all monthly wireless bills must be charged to the card.'),
    ('mobile_device_insurance', 'coverage_window', 'MUST_MATCH', 'device_days_since_purchase', 'PURCHASE_AGE_BETWEEN', '{"minimum": 91, "maximum": 730}', 'days', 'Mobile Device Insurance begins 91 days after purchase and ends two years after purchase.'),
    ('mobile_device_insurance', 'account_status', 'MUST_MATCH', 'account_good_standing', 'EQ', 'true', null, 'Coverage requires the account to remain open and not 60 days past due.')
) as seed(feature_code, rule_category, rule_effect, rule_key, operator, value_json, unit, description)
  on seed.feature_code = ft.code
where c.slug = 'rbc-avion-visa-infinite'
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
    ('canadian_resident', 'canadian_resident'),
    ('government_health_plan_active', 'government_health_plan_active'),
    ('age_under_65', 'traveller_age'),
    ('trip_days_under_65', 'trip_duration_days'),
    ('age_65_or_older', 'traveller_age'),
    ('trip_days_65_or_older', 'trip_duration_days'),
    ('covered_person_relationship', 'insured_person_relationship'),
    ('common_carrier_fare_payment_percentage', 'payment_percentage'),
    ('rental_payment_percentage', 'payment_percentage'),
    ('rental_duration', 'rental_duration_days'),
    ('rental_cdw_declined', 'rental_agency_cdw_declined'),
    ('rental_driver_authorized', 'authorized_rental_driver'),
    ('rental_vehicle_msrp_over_limit', 'vehicle_value'),
    ('trip_payment_percentage', 'payment_percentage'),
    ('air_ticket_payment_percentage', 'payment_percentage'),
    ('baggage_delay_hours', 'delay_duration_hours'),
    ('air_carrier_check_in', 'air_carrier_check_in_completed'),
    ('flight_delay_hours', 'delay_duration_hours'),
    ('forced_entry_burglary', 'incident_type'),
    ('item_payment_percentage', 'payment_percentage'),
    ('days_since_purchase', 'purchase_date'),
    ('device_payment_percentage', 'payment_percentage'),
    ('wireless_bill_payment', 'wireless_bill_charged_to_card'),
    ('device_days_since_purchase', 'purchase_date'),
    ('account_good_standing', 'account_in_good_standing')
) as mapping(rule_key, input_code) on mapping.rule_key = fr.rule_key
join public.evaluation_inputs ei on ei.code = mapping.input_code
where c.slug = 'rbc-avion-visa-infinite'
on conflict do nothing;

insert into public.rule_groups (card_feature_id, operator, description)
select cf.id, 'OR', 'Age-dependent emergency medical trip-duration eligibility'
from public.cards c
join public.card_versions cv on cv.card_id = c.id and cv.status = 'CURRENT'
join public.card_features cf on cf.card_version_id = cv.id
join public.feature_types ft on ft.id = cf.feature_type_id and ft.code = 'travel_emergency_medical'
where c.slug = 'rbc-avion-visa-infinite'
  and not exists (
    select 1 from public.rule_groups rg
    where rg.card_feature_id = cf.id and rg.description = 'Age-dependent emergency medical trip-duration eligibility'
  );

insert into public.rule_groups (card_feature_id, operator, parent_group_id, description)
select root.card_feature_id, 'AND', root.id, branch.description
from public.rule_groups root
cross join (values ('Under age 65 branch'), ('Age 65 or older branch')) as branch(description)
where root.description = 'Age-dependent emergency medical trip-duration eligibility'
  and not exists (
    select 1 from public.rule_groups existing
    where existing.parent_group_id = root.id and existing.description = branch.description
  );

insert into public.rule_group_members (rule_group_id, child_group_id, sort_order)
select parent.id, child.id, row_number() over (partition by parent.id order by child.description)
from public.rule_groups parent
join public.rule_groups child on child.parent_group_id = parent.id
where parent.description = 'Age-dependent emergency medical trip-duration eligibility'
  and not exists (
    select 1 from public.rule_group_members rgm
    where rgm.rule_group_id = parent.id and rgm.child_group_id = child.id
  );

insert into public.rule_group_members (rule_group_id, rule_id, sort_order)
select branch.id, fr.id, row_number() over (partition by branch.id order by fr.rule_key)
from public.rule_groups branch
join public.card_features cf on cf.id = branch.card_feature_id
join public.feature_rules fr on fr.card_feature_id = cf.id
where (
    (branch.description = 'Under age 65 branch' and fr.rule_key in ('age_under_65', 'trip_days_under_65'))
    or (branch.description = 'Age 65 or older branch' and fr.rule_key in ('age_65_or_older', 'trip_days_65_or_older'))
  )
  and not exists (
    select 1 from public.rule_group_members rgm
    where rgm.rule_group_id = branch.id and rgm.rule_id = fr.id
  );

insert into public.rule_groups (card_feature_id, operator, description)
select cf.id, 'OR', 'Mobile device purchase eligibility'
from public.cards c
join public.card_versions cv on cv.card_id = c.id and cv.status = 'CURRENT'
join public.card_features cf on cf.card_version_id = cv.id
join public.feature_types ft on ft.id = cf.feature_type_id and ft.code = 'mobile_device_insurance'
where c.slug = 'rbc-avion-visa-infinite'
  and not exists (
    select 1 from public.rule_groups rg
    where rg.card_feature_id = cf.id and rg.description = 'Mobile device purchase eligibility'
  );

insert into public.rule_group_members (rule_group_id, rule_id, sort_order)
select rg.id, fr.id, row_number() over (partition by rg.id order by fr.rule_key)
from public.rule_groups rg
join public.feature_rules fr on fr.card_feature_id = rg.card_feature_id
where rg.description = 'Mobile device purchase eligibility'
  and fr.rule_key in ('device_payment_percentage', 'wireless_bill_payment')
  and not exists (
    select 1 from public.rule_group_members rgm
    where rgm.rule_group_id = rg.id and rgm.rule_id = fr.id
  );

insert into public.feature_limits (
  card_feature_id, limit_type, amount, currency, quantity, unit, period, description,
  verification_status, risk_level
)
select cf.id, seed.limit_type, seed.amount, seed.currency, seed.quantity, seed.unit,
  seed.period, seed.description, 'VERIFIED', 'HIGH'
from public.cards c
join public.card_versions cv on cv.card_id = c.id and cv.status = 'CURRENT'
join public.card_features cf on cf.card_version_id = cv.id
join public.feature_types ft on ft.id = cf.feature_type_id
join (
  values
    ('travel_emergency_medical', 'maximum_benefit', null::numeric, null, null::numeric, 'unlimited', 'per covered person', 'Maximum emergency medical benefit is unlimited unless otherwise noted.'),
    ('travel_emergency_medical', 'maximum_trip_duration_under_65', null, null, 15, 'days', 'per trip', 'Maximum covered trip duration when under age 65.'),
    ('travel_emergency_medical', 'maximum_trip_duration_65_or_older', null, null, 3, 'days', 'per trip', 'Maximum covered trip duration when age 65 or older.'),
    ('travel_accident', 'maximum_specific_loss_indemnity', 500000, 'CAD', null, null, 'per covered person', 'Maximum listed specific-loss indemnity.'),
    ('rental_car_collision_damage', 'maximum_rental_duration', null, null, 48, 'days', 'per coverage period', 'Maximum consecutive rental coverage period.'),
    ('rental_car_collision_damage', 'maximum_vehicle_msrp', 65000, 'CAD', null, null, 'per vehicle', 'Vehicles above this model-year MSRP are excluded.'),
    ('trip_cancellation', 'per_person_limit', 1500, 'CAD', null, null, 'per trip', 'Maximum per covered person per trip.'),
    ('trip_cancellation', 'overall_limit', 5000, 'CAD', null, null, 'per trip', 'Overall maximum for covered persons.'),
    ('trip_interruption', 'per_person_limit', 5000, 'CAD', null, null, 'per trip', 'Maximum per covered person per trip.'),
    ('trip_interruption', 'overall_limit', 25000, 'CAD', null, null, 'per trip', 'Overall maximum for covered persons.'),
    ('baggage_delay', 'per_occurrence_limit', 500, 'CAD', null, null, 'per occurrence', 'Maximum emergency-purchase reimbursement per occurrence.'),
    ('baggage_delay', 'overall_limit', 2500, 'CAD', null, null, 'per occurrence', 'Overall maximum for all covered persons.'),
    ('flight_delay', 'per_day_limit', 250, 'CAD', null, null, 'per covered person per day', 'Maximum eligible-expense reimbursement per covered person per day.'),
    ('flight_delay', 'overall_limit', 500, 'CAD', null, null, 'per occurrence', 'Overall maximum for all covered persons.'),
    ('hotel_motel_burglary', 'per_occurrence_limit', 2500, 'CAD', null, null, 'per occurrence', 'Maximum repair or replacement reimbursement.'),
    ('purchase_protection', 'coverage_window', null, null, 90, 'days', 'from purchase', 'Purchase Security coverage period.'),
    ('purchase_protection', 'annual_account_limit', 50000, 'CAD', null, null, 'per calendar year', 'Maximum per RBC Avion Visa Infinite account.'),
    ('extended_warranty', 'maximum_extension', null, null, 1, 'year', 'per insured item', 'Maximum manufacturer-warranty extension.'),
    ('extended_warranty', 'maximum_combined_warranty', null, null, 5, 'years', 'per insured item', 'Maximum combined original and extended warranty.'),
    ('mobile_device_insurance', 'per_claim_limit', 1500, 'CAD', null, null, 'per claim', 'Maximum reimbursement before applicable depreciation and deductible.'),
    ('mobile_device_insurance', 'waiting_period', null, null, 91, 'days', 'from purchase', 'Coverage begins 91 days after purchase.'),
    ('mobile_device_insurance', 'coverage_window', null, null, 2, 'years', 'from purchase', 'Maximum coverage duration.'),
    ('mobile_device_insurance', 'claim_frequency_12_months', null, null, 1, 'claim', 'per 12 consecutive months', 'Maximum claim frequency.'),
    ('mobile_device_insurance', 'claim_frequency_48_months', null, null, 2, 'claims', 'per 48 consecutive months', 'Maximum claim frequency.')
) as seed(feature_code, limit_type, amount, currency, quantity, unit, period, description)
  on seed.feature_code = ft.code
where c.slug = 'rbc-avion-visa-infinite'
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
join public.source_documents sd on sd.source_url = 'https://www.rbcroyalbank.com/credit-cards/travel/rbc-visa-infinite-avion/rbc-visa-infinite-avion-certificate-of-insurance.pdf'
join public.source_citations sc on sc.source_document_id = sd.id
join (
  values
    ('travel_emergency_medical', 'Emergency Medical — covered persons'),
    ('travel_accident', 'Travel Accident — eligibility and specific loss indemnity'),
    ('rental_car_collision_damage', 'Auto Rental — eligibility summary'),
    ('trip_cancellation', 'Trip Cancellation and Interruption — coverage'),
    ('trip_interruption', 'Trip Cancellation and Interruption — coverage'),
    ('baggage_delay', 'Delayed Baggage — eligibility and timing'),
    ('flight_delay', 'Flight Delay — eligibility and timing'),
    ('hotel_motel_burglary', 'Hotel/Motel Burglary — coverage'),
    ('purchase_protection', 'Purchase Security — coverage and limits'),
    ('extended_warranty', 'Extended Warranty — coverage and limits'),
    ('mobile_device_insurance', 'Mobile Device — eligibility and duration')
) as mapping(feature_code, section) on mapping.feature_code = ft.code and mapping.section = sc.section
where c.slug = 'rbc-avion-visa-infinite'
on conflict do nothing;

insert into public.feature_rule_citations (rule_id, citation_id)
select fr.id, sc.id
from public.cards c
join public.card_versions cv on cv.card_id = c.id and cv.status = 'CURRENT'
join public.card_features cf on cf.card_version_id = cv.id
join public.feature_rules fr on fr.card_feature_id = cf.id
join public.source_documents sd on sd.source_url = 'https://www.rbcroyalbank.com/credit-cards/travel/rbc-visa-infinite-avion/rbc-visa-infinite-avion-certificate-of-insurance.pdf'
join public.source_citations sc on sc.source_document_id = sd.id
join (
  values
    ('canadian_resident', 'Emergency Medical — covered persons'),
    ('government_health_plan_active', 'Emergency Medical — covered persons'),
    ('age_under_65', 'Emergency Medical — coverage duration'),
    ('trip_days_under_65', 'Emergency Medical — coverage duration'),
    ('age_65_or_older', 'Emergency Medical — coverage duration'),
    ('trip_days_65_or_older', 'Emergency Medical — coverage duration'),
    ('covered_person_relationship', 'Travel Accident — eligibility and specific loss indemnity'),
    ('common_carrier_fare_payment_percentage', 'Travel Accident — eligibility and specific loss indemnity'),
    ('rental_payment_percentage', 'Auto Rental — coverage conditions'),
    ('rental_duration', 'Auto Rental — eligibility summary'),
    ('rental_cdw_declined', 'Auto Rental — coverage conditions'),
    ('rental_driver_authorized', 'Auto Rental — authorized drivers'),
    ('rental_vehicle_msrp_over_limit', 'Auto Rental — vehicle exclusions'),
    ('trip_payment_percentage', 'Trip Cancellation and Interruption — coverage'),
    ('air_ticket_payment_percentage', 'Flight Delay — eligibility and timing'),
    ('baggage_delay_hours', 'Delayed Baggage — eligibility and timing'),
    ('air_carrier_check_in', 'Flight Delay — eligibility and timing'),
    ('flight_delay_hours', 'Flight Delay — eligibility and timing'),
    ('forced_entry_burglary', 'Hotel/Motel Burglary — coverage'),
    ('item_payment_percentage', 'Purchase Security — coverage and limits'),
    ('days_since_purchase', 'Purchase Security — coverage and limits'),
    ('device_payment_percentage', 'Mobile Device — eligibility and duration'),
    ('wireless_bill_payment', 'Mobile Device — eligibility and duration'),
    ('device_days_since_purchase', 'Mobile Device — eligibility and duration'),
    ('account_good_standing', 'Mobile Device — eligibility and duration')
) as mapping(rule_key, section) on mapping.rule_key = fr.rule_key and mapping.section = sc.section
where c.slug = 'rbc-avion-visa-infinite'
on conflict do nothing;

insert into public.feature_limit_citations (feature_limit_id, citation_id)
select fl.id, sc.id
from public.cards c
join public.card_versions cv on cv.card_id = c.id and cv.status = 'CURRENT'
join public.card_features cf on cf.card_version_id = cv.id
join public.feature_types ft on ft.id = cf.feature_type_id
join public.feature_limits fl on fl.card_feature_id = cf.id
join public.source_documents sd on sd.source_url = 'https://www.rbcroyalbank.com/credit-cards/travel/rbc-visa-infinite-avion/rbc-visa-infinite-avion-certificate-of-insurance.pdf'
join public.source_citations sc on sc.source_document_id = sd.id
join (
  values
    ('travel_emergency_medical', 'maximum_benefit', 'Emergency Medical — maximum benefit'),
    ('travel_emergency_medical', 'maximum_trip_duration_under_65', 'Emergency Medical — coverage duration'),
    ('travel_emergency_medical', 'maximum_trip_duration_65_or_older', 'Emergency Medical — coverage duration'),
    ('travel_accident', 'maximum_specific_loss_indemnity', 'Travel Accident — eligibility and specific loss indemnity'),
    ('rental_car_collision_damage', 'maximum_rental_duration', 'Auto Rental — eligibility summary'),
    ('rental_car_collision_damage', 'maximum_vehicle_msrp', 'Auto Rental — vehicle exclusions'),
    ('trip_cancellation', 'per_person_limit', 'Trip Cancellation and Interruption — limits'),
    ('trip_cancellation', 'overall_limit', 'Trip Cancellation and Interruption — limits'),
    ('trip_interruption', 'per_person_limit', 'Trip Cancellation and Interruption — limits'),
    ('trip_interruption', 'overall_limit', 'Trip Cancellation and Interruption — limits'),
    ('baggage_delay', 'per_occurrence_limit', 'Delayed Baggage and Flight Delay — limits'),
    ('baggage_delay', 'overall_limit', 'Delayed Baggage and Flight Delay — limits'),
    ('flight_delay', 'per_day_limit', 'Delayed Baggage and Flight Delay — limits'),
    ('flight_delay', 'overall_limit', 'Delayed Baggage and Flight Delay — limits'),
    ('hotel_motel_burglary', 'per_occurrence_limit', 'Hotel/Motel Burglary — coverage'),
    ('purchase_protection', 'coverage_window', 'Purchase Security — coverage and limits'),
    ('purchase_protection', 'annual_account_limit', 'Purchase Security — coverage and limits'),
    ('extended_warranty', 'maximum_extension', 'Extended Warranty — coverage and limits'),
    ('extended_warranty', 'maximum_combined_warranty', 'Extended Warranty — coverage and limits'),
    ('mobile_device_insurance', 'per_claim_limit', 'Mobile Device — benefit and frequency limits'),
    ('mobile_device_insurance', 'waiting_period', 'Mobile Device — eligibility and duration'),
    ('mobile_device_insurance', 'coverage_window', 'Mobile Device — eligibility and duration'),
    ('mobile_device_insurance', 'claim_frequency_12_months', 'Mobile Device — benefit and frequency limits'),
    ('mobile_device_insurance', 'claim_frequency_48_months', 'Mobile Device — benefit and frequency limits')
) as mapping(feature_code, limit_type, section)
  on mapping.feature_code = ft.code and mapping.limit_type = fl.limit_type and mapping.section = sc.section
where c.slug = 'rbc-avion-visa-infinite'
on conflict do nothing;

do $$
declare
  uncited_features integer;
  uncited_rules integer;
  uncited_limits integer;
  other_card_features integer;
begin
  select count(*) into uncited_features
  from public.cards c
  join public.card_versions cv on cv.card_id = c.id and cv.status = 'CURRENT'
  join public.card_features cf on cf.card_version_id = cv.id
  left join public.card_feature_citations cfc on cfc.card_feature_id = cf.id
  where c.slug = 'rbc-avion-visa-infinite' and cf.verification_status = 'VERIFIED' and cfc.card_feature_id is null;

  select count(*) into uncited_rules
  from public.cards c
  join public.card_versions cv on cv.card_id = c.id and cv.status = 'CURRENT'
  join public.card_features cf on cf.card_version_id = cv.id
  join public.feature_rules fr on fr.card_feature_id = cf.id
  left join public.feature_rule_citations frc on frc.rule_id = fr.id
  where c.slug = 'rbc-avion-visa-infinite' and fr.verification_status = 'VERIFIED' and frc.rule_id is null;

  select count(*) into uncited_limits
  from public.cards c
  join public.card_versions cv on cv.card_id = c.id and cv.status = 'CURRENT'
  join public.card_features cf on cf.card_version_id = cv.id
  join public.feature_limits fl on fl.card_feature_id = cf.id
  left join public.feature_limit_citations flc on flc.feature_limit_id = fl.id
  where c.slug = 'rbc-avion-visa-infinite' and fl.verification_status = 'VERIFIED' and flc.feature_limit_id is null;

  select count(*) into other_card_features
  from public.card_features cf
  join public.card_versions cv on cv.id = cf.card_version_id
  join public.cards c on c.id = cv.card_id
  join public.card_feature_citations cfc on cfc.card_feature_id = cf.id
  join public.source_citations sc on sc.id = cfc.citation_id
  join public.source_documents sd on sd.id = sc.source_document_id
  where sd.source_url = 'https://www.rbcroyalbank.com/credit-cards/travel/rbc-visa-infinite-avion/rbc-visa-infinite-avion-certificate-of-insurance.pdf'
    and c.slug <> 'rbc-avion-visa-infinite';

  if uncited_features <> 0 or uncited_rules <> 0 or uncited_limits <> 0 then
    raise exception 'Step 21A citation validation failed: % features, % rules, % limits uncited',
      uncited_features, uncited_rules, uncited_limits;
  end if;

  if other_card_features <> 0 then
    raise exception 'Step 21A unexpectedly linked RBC pilot evidence to % non-RBC features', other_card_features;
  end if;
end
$$;

commit;
