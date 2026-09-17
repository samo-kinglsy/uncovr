begin;

create table public.card_feature_presentations (
  id uuid primary key default gen_random_uuid(),
  card_feature_id uuid not null unique references public.card_features (id) on delete cascade,
  short_name text,
  plain_language_summary text not null,
  verification_status text not null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (short_name is null or btrim(short_name) <> ''),
  check (btrim(plain_language_summary) <> ''),
  check (verification_status in ('DRAFT', 'VERIFIED', 'REVIEW_REQUIRED', 'SOURCE_CONFLICT')),
  check (verification_status <> 'VERIFIED' or verified_at is not null)
);

create table public.card_feature_presentation_items (
  id uuid primary key default gen_random_uuid(),
  presentation_id uuid not null references public.card_feature_presentations (id) on delete cascade,
  item_type text not null,
  plain_language_text text not null,
  feature_rule_id uuid references public.feature_rules (id) on delete restrict,
  feature_limit_id uuid references public.feature_limits (id) on delete restrict,
  sort_order integer not null,
  verification_status text not null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (presentation_id, sort_order),
  check (item_type in ('CONDITION', 'LIMITATION')),
  check (btrim(plain_language_text) <> ''),
  check ((feature_rule_id is null) <> (feature_limit_id is null)),
  check (sort_order > 0),
  check (verification_status in ('DRAFT', 'VERIFIED', 'REVIEW_REQUIRED', 'SOURCE_CONFLICT')),
  check (verification_status <> 'VERIFIED' or verified_at is not null)
);

create table public.card_feature_presentation_citations (
  presentation_id uuid references public.card_feature_presentations (id) on delete cascade,
  citation_id uuid references public.source_citations (id) on delete restrict,
  primary key (presentation_id, citation_id)
);

comment on table public.card_feature_presentations is
  'Reviewed consumer-facing explanations derived from, but never authoritative over, verified benefit facts.';
comment on table public.card_feature_presentation_items is
  'Ordered plain-language conditions and limitations, each anchored to exactly one authoritative rule or limit.';
comment on column public.card_feature_presentations.plain_language_summary is
  'Presentation copy only; must not be used to evaluate benefit eligibility.';
comment on column public.card_feature_presentation_items.plain_language_text is
  'Presentation copy only; eligibility logic remains in the linked feature rule or limit.';

create index card_feature_presentation_items_presentation_id_idx
on public.card_feature_presentation_items (presentation_id);
create index card_feature_presentation_items_feature_rule_id_idx
on public.card_feature_presentation_items (feature_rule_id)
where feature_rule_id is not null;
create index card_feature_presentation_items_feature_limit_id_idx
on public.card_feature_presentation_items (feature_limit_id)
where feature_limit_id is not null;
create index card_feature_presentation_citations_citation_id_idx
on public.card_feature_presentation_citations (citation_id);

alter table public.card_feature_presentations enable row level security;
alter table public.card_feature_presentation_items enable row level security;
alter table public.card_feature_presentation_citations enable row level security;

revoke all on table
  public.card_feature_presentations,
  public.card_feature_presentation_items,
  public.card_feature_presentation_citations
from anon, authenticated;

grant select on table
  public.card_feature_presentations,
  public.card_feature_presentation_items,
  public.card_feature_presentation_citations
to authenticated;

create policy "Authenticated users can read card feature presentations"
on public.card_feature_presentations for select to authenticated using (true);
create policy "Authenticated users can read card feature presentation items"
on public.card_feature_presentation_items for select to authenticated using (true);
create policy "Authenticated users can read card feature presentation citations"
on public.card_feature_presentation_citations for select to authenticated using (true);

create function public.validate_card_feature_presentation(presentation_uuid uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  presentation record;
begin
  select
    cfp.id,
    cfp.card_feature_id,
    cfp.verification_status,
    cf.verification_status as feature_status,
    cv.card_id
  into presentation
  from public.card_feature_presentations cfp
  join public.card_features cf on cf.id = cfp.card_feature_id
  join public.card_versions cv on cv.id = cf.card_version_id
  where cfp.id = presentation_uuid;

  if not found then
    return;
  end if;

  if presentation.verification_status = 'VERIFIED' then
    if presentation.feature_status <> 'VERIFIED' then
      raise exception 'VERIFIED presentation % requires a VERIFIED card feature', presentation.id;
    end if;

    if not exists (
      select 1
      from public.card_feature_presentation_citations cfpc
      where cfpc.presentation_id = presentation.id
    ) then
      raise exception 'VERIFIED presentation % requires at least one source citation', presentation.id;
    end if;

    if exists (
      select 1
      from public.card_feature_presentation_citations cfpc
      join public.source_citations sc on sc.id = cfpc.citation_id
      left join public.card_sources cs
        on cs.card_id = presentation.card_id
       and cs.source_document_id = sc.source_document_id
      where cfpc.presentation_id = presentation.id
        and cs.card_id is null
    ) then
      raise exception 'VERIFIED presentation % cites a source not linked to its card', presentation.id;
    end if;
  end if;

  if exists (
    select 1
    from public.card_feature_presentation_items cfpi
    left join public.feature_rules fr on fr.id = cfpi.feature_rule_id
    left join public.feature_limits fl on fl.id = cfpi.feature_limit_id
    where cfpi.presentation_id = presentation.id
      and coalesce(fr.card_feature_id, fl.card_feature_id) <> presentation.card_feature_id
  ) then
    raise exception 'Presentation % has an item linked to a different card feature', presentation.id;
  end if;
end
$$;

create function public.enforce_card_feature_presentation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform public.validate_card_feature_presentation(coalesce(new.id, old.id));
  return null;
end
$$;

create function public.enforce_card_feature_presentation_citation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op <> 'DELETE' then
    perform public.validate_card_feature_presentation(new.presentation_id);
  end if;
  if tg_op <> 'INSERT'
     and (tg_op = 'DELETE' or old.presentation_id is distinct from new.presentation_id) then
    perform public.validate_card_feature_presentation(old.presentation_id);
  end if;
  return null;
end
$$;

create function public.validate_card_feature_presentation_item(item_uuid uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  item record;
begin
  select
    cfpi.id,
    cfpi.verification_status,
    cfpi.feature_rule_id,
    cfpi.feature_limit_id,
    cfp.card_feature_id as presentation_feature_id,
    coalesce(fr.card_feature_id, fl.card_feature_id) as anchor_feature_id,
    coalesce(fr.verification_status, fl.verification_status) as anchor_status
  into item
  from public.card_feature_presentation_items cfpi
  join public.card_feature_presentations cfp on cfp.id = cfpi.presentation_id
  left join public.feature_rules fr on fr.id = cfpi.feature_rule_id
  left join public.feature_limits fl on fl.id = cfpi.feature_limit_id
  where cfpi.id = item_uuid;

  if not found then
    return;
  end if;

  if item.anchor_feature_id <> item.presentation_feature_id then
    raise exception 'Presentation item % must reference a fact from the same card feature', item.id;
  end if;

  if item.verification_status = 'VERIFIED' and item.anchor_status <> 'VERIFIED' then
    raise exception 'VERIFIED presentation item % requires a VERIFIED underlying fact', item.id;
  end if;

  if item.verification_status = 'VERIFIED'
     and item.feature_rule_id is not null
     and not exists (
       select 1 from public.feature_rule_citations frc where frc.rule_id = item.feature_rule_id
     ) then
    raise exception 'VERIFIED presentation item % requires cited rule evidence', item.id;
  end if;

  if item.verification_status = 'VERIFIED'
     and item.feature_limit_id is not null
     and not exists (
       select 1 from public.feature_limit_citations flc where flc.feature_limit_id = item.feature_limit_id
     ) then
    raise exception 'VERIFIED presentation item % requires cited limit evidence', item.id;
  end if;
end
$$;

create function public.enforce_card_feature_presentation_item()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform public.validate_card_feature_presentation_item(coalesce(new.id, old.id));
  return null;
end
$$;

create function public.enforce_presentation_items_for_rule()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  item_id uuid;
begin
  for item_id in
    select cfpi.id
    from public.card_feature_presentation_items cfpi
    where cfpi.feature_rule_id = new.id
  loop
    perform public.validate_card_feature_presentation_item(item_id);
  end loop;
  return null;
end
$$;

create function public.enforce_presentation_items_for_limit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  item_id uuid;
begin
  for item_id in
    select cfpi.id
    from public.card_feature_presentation_items cfpi
    where cfpi.feature_limit_id = new.id
  loop
    perform public.validate_card_feature_presentation_item(item_id);
  end loop;
  return null;
end
$$;

create function public.enforce_presentations_for_card_feature()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  presentation_id uuid;
begin
  for presentation_id in
    select cfp.id
    from public.card_feature_presentations cfp
    where cfp.card_feature_id = new.id
  loop
    perform public.validate_card_feature_presentation(presentation_id);
  end loop;
  return null;
end
$$;

create function public.enforce_presentation_items_for_rule_citation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  item_id uuid;
begin
  for item_id in
    select cfpi.id
    from public.card_feature_presentation_items cfpi
    where (tg_op <> 'DELETE' and cfpi.feature_rule_id = new.rule_id)
       or (tg_op <> 'INSERT' and cfpi.feature_rule_id = old.rule_id)
  loop
    perform public.validate_card_feature_presentation_item(item_id);
  end loop;
  return null;
end
$$;

create function public.enforce_presentation_items_for_limit_citation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  item_id uuid;
begin
  for item_id in
    select cfpi.id
    from public.card_feature_presentation_items cfpi
    where (tg_op <> 'DELETE' and cfpi.feature_limit_id = new.feature_limit_id)
       or (tg_op <> 'INSERT' and cfpi.feature_limit_id = old.feature_limit_id)
  loop
    perform public.validate_card_feature_presentation_item(item_id);
  end loop;
  return null;
end
$$;

create constraint trigger card_feature_presentations_validate
after insert or update on public.card_feature_presentations
deferrable initially deferred
for each row execute function public.enforce_card_feature_presentation();

create constraint trigger card_feature_presentation_citations_validate
after insert or update or delete on public.card_feature_presentation_citations
deferrable initially deferred
for each row execute function public.enforce_card_feature_presentation_citation();

create constraint trigger card_feature_presentation_items_validate
after insert or update on public.card_feature_presentation_items
deferrable initially deferred
for each row execute function public.enforce_card_feature_presentation_item();

create constraint trigger feature_rules_presentation_items_validate
after update of card_feature_id, verification_status on public.feature_rules
deferrable initially deferred
for each row execute function public.enforce_presentation_items_for_rule();

create constraint trigger feature_limits_presentation_items_validate
after update of card_feature_id, verification_status on public.feature_limits
deferrable initially deferred
for each row execute function public.enforce_presentation_items_for_limit();

create constraint trigger card_features_presentations_validate
after update of verification_status on public.card_features
deferrable initially deferred
for each row execute function public.enforce_presentations_for_card_feature();

create constraint trigger feature_rule_citations_presentation_items_validate
after insert or update or delete on public.feature_rule_citations
deferrable initially deferred
for each row execute function public.enforce_presentation_items_for_rule_citation();

create constraint trigger feature_limit_citations_presentation_items_validate
after insert or update or delete on public.feature_limit_citations
deferrable initially deferred
for each row execute function public.enforce_presentation_items_for_limit_citation();

insert into public.card_feature_presentations (
  card_feature_id, short_name, plain_language_summary, verification_status, verified_at
)
select
  cf.id,
  seed.short_name,
  seed.plain_language_summary,
  'VERIFIED',
  timestamptz '2026-09-17 00:00:00-04'
from public.cards c
join public.card_versions cv on cv.card_id = c.id and cv.status = 'CURRENT'
join public.card_features cf on cf.card_version_id = cv.id
join public.feature_types ft on ft.id = cf.feature_type_id
join (
  values
    ('rbc-avion-visa-infinite', 'travel_emergency_medical', 'Emergency medical insurance', 'May help pay eligible emergency medical expenses when an insured person travels outside their home province or territory.'),
    ('rbc-avion-visa-infinite', 'travel_accident', 'Travel accident insurance', 'May provide a benefit for covered accidental death or serious injury while travelling on an eligible common carrier, when the full fare is paid with the card and/or Avion points.'),
    ('rbc-avion-visa-infinite', 'rental_car_collision_damage', 'Rental car damage insurance', 'May help pay for theft or damage to an eligible rental car when the full rental cost is paid with the card and/or Avion points and the rental company’s damage waiver is declined.'),
    ('rbc-avion-visa-infinite', 'trip_cancellation', 'Trip cancellation insurance', 'May reimburse eligible non-refundable prepaid travel costs when a covered reason forces an insured person to cancel a trip.'),
    ('rbc-avion-visa-infinite', 'trip_interruption', 'Trip interruption insurance', 'May reimburse eligible costs when a covered reason interrupts or delays an insured person’s trip.'),
    ('rbc-avion-visa-infinite', 'baggage_delay', 'Delayed baggage insurance', 'May reimburse essential emergency purchases when eligible checked baggage is delayed for at least four hours.'),
    ('rbc-avion-visa-infinite', 'flight_delay', 'Flight delay insurance', 'May reimburse eligible expenses after an eligible flight delay of at least four hours.'),
    ('rbc-avion-visa-infinite', 'hotel_motel_burglary', 'Hotel and motel burglary insurance', 'May help repair or replace eligible belongings stolen or damaged during a forced-entry burglary of a hotel room, motel room, or cruise cabin.'),
    ('rbc-avion-visa-infinite', 'purchase_protection', 'Purchase protection', 'May help repair or replace eligible new items that are lost or accidentally damaged within 90 days of purchase.'),
    ('rbc-avion-visa-infinite', 'extended_warranty', 'Extended warranty', 'May add up to one year to an eligible item’s original manufacturer warranty when the item is paid in full with the card and/or Avion points.'),
    ('rbc-avion-visa-infinite', 'mobile_device_insurance', 'Mobile device insurance', 'May help with eligible mobile-device claims for up to two years after purchase, after a 91-day waiting period.'),
    ('triangle-mastercard', 'installment_financing', 'No-interest payment plan', 'May let qualifying purchases of at least $150 at participating retailers be split into equal monthly payments without plan interest or an administration fee, when requested and approved.'),
    ('triangle-mastercard', 'points_redemption', 'Redeem CT Money', 'Lets eligible Triangle Rewards members redeem CT Money at participating Triangle retailers, where $1 in CT Money has $1 in redemption value.')
) as seed(card_slug, feature_code, short_name, plain_language_summary)
  on seed.card_slug = c.slug and seed.feature_code = ft.code
where cf.verification_status = 'VERIFIED';

insert into public.card_feature_presentation_citations (presentation_id, citation_id)
select cfp.id, sc.id
from public.card_feature_presentations cfp
join public.card_features cf on cf.id = cfp.card_feature_id
join public.card_versions cv on cv.id = cf.card_version_id and cv.status = 'CURRENT'
join public.cards c on c.id = cv.card_id
join public.feature_types ft on ft.id = cf.feature_type_id
join (
  values
    ('rbc-avion-visa-infinite', 'travel_emergency_medical', 'https://www.rbcroyalbank.com/credit-cards/travel/rbc-visa-infinite-avion/rbc-visa-infinite-avion-certificate-of-insurance.pdf', 'Emergency Medical — covered persons'),
    ('rbc-avion-visa-infinite', 'travel_emergency_medical', 'https://www.rbcroyalbank.com/credit-cards/travel/rbc-visa-infinite-avion/rbc-visa-infinite-avion-certificate-of-insurance.pdf', 'Emergency Medical — maximum benefit'),
    ('rbc-avion-visa-infinite', 'travel_accident', 'https://www.rbcroyalbank.com/credit-cards/travel/rbc-visa-infinite-avion/rbc-visa-infinite-avion-certificate-of-insurance.pdf', 'Travel Accident — eligibility and specific loss indemnity'),
    ('rbc-avion-visa-infinite', 'rental_car_collision_damage', 'https://www.rbcroyalbank.com/credit-cards/travel/rbc-visa-infinite-avion/rbc-visa-infinite-avion-certificate-of-insurance.pdf', 'Auto Rental — eligibility summary'),
    ('rbc-avion-visa-infinite', 'rental_car_collision_damage', 'https://www.rbcroyalbank.com/credit-cards/travel/rbc-visa-infinite-avion/rbc-visa-infinite-avion-certificate-of-insurance.pdf', 'Auto Rental — coverage conditions'),
    ('rbc-avion-visa-infinite', 'trip_cancellation', 'https://www.rbcroyalbank.com/credit-cards/travel/rbc-visa-infinite-avion/rbc-visa-infinite-avion-certificate-of-insurance.pdf', 'Trip Cancellation and Interruption — coverage'),
    ('rbc-avion-visa-infinite', 'trip_interruption', 'https://www.rbcroyalbank.com/credit-cards/travel/rbc-visa-infinite-avion/rbc-visa-infinite-avion-certificate-of-insurance.pdf', 'Trip Cancellation and Interruption — coverage'),
    ('rbc-avion-visa-infinite', 'baggage_delay', 'https://www.rbcroyalbank.com/credit-cards/travel/rbc-visa-infinite-avion/rbc-visa-infinite-avion-certificate-of-insurance.pdf', 'Delayed Baggage — eligibility and timing'),
    ('rbc-avion-visa-infinite', 'flight_delay', 'https://www.rbcroyalbank.com/credit-cards/travel/rbc-visa-infinite-avion/rbc-visa-infinite-avion-certificate-of-insurance.pdf', 'Flight Delay — eligibility and timing'),
    ('rbc-avion-visa-infinite', 'hotel_motel_burglary', 'https://www.rbcroyalbank.com/credit-cards/travel/rbc-visa-infinite-avion/rbc-visa-infinite-avion-certificate-of-insurance.pdf', 'Hotel/Motel Burglary — coverage'),
    ('rbc-avion-visa-infinite', 'purchase_protection', 'https://www.rbcroyalbank.com/credit-cards/travel/rbc-visa-infinite-avion/rbc-visa-infinite-avion-certificate-of-insurance.pdf', 'Purchase Security — coverage and limits'),
    ('rbc-avion-visa-infinite', 'extended_warranty', 'https://www.rbcroyalbank.com/credit-cards/travel/rbc-visa-infinite-avion/rbc-visa-infinite-avion-certificate-of-insurance.pdf', 'Extended Warranty — coverage and limits'),
    ('rbc-avion-visa-infinite', 'mobile_device_insurance', 'https://www.rbcroyalbank.com/credit-cards/travel/rbc-visa-infinite-avion/rbc-visa-infinite-avion-certificate-of-insurance.pdf', 'Mobile Device — eligibility and duration'),
    ('rbc-avion-visa-infinite', 'mobile_device_insurance', 'https://www.rbcroyalbank.com/credit-cards/travel/rbc-visa-infinite-avion/rbc-visa-infinite-avion-certificate-of-insurance.pdf', 'Mobile Device — benefit and frequency limits'),
    ('triangle-mastercard', 'installment_financing', 'https://triangle.canadiantire.ca/en/credit-cards/triangle-mastercard.html', 'Additional Perks — Turn Big Purchases into Small Payments'),
    ('triangle-mastercard', 'installment_financing', 'https://triangle.canadiantire.ca/en/support/mastercard-customers.html', 'Equal payments, no interest financing'),
    ('triangle-mastercard', 'installment_financing', 'https://triangle.canadiantire.ca/en/support/mastercard-customers.html', 'Special payment plan conditions'),
    ('triangle-mastercard', 'points_redemption', 'https://triangle.canadiantire.ca/en/credit-cards/triangle-mastercard.html', 'Redeem For The Things You Love'),
    ('triangle-mastercard', 'points_redemption', 'https://triangle.canadiantire.ca/en/support/legal-and-privacy/program-rules.html', 'Triangle Rewards membership')
) as mapping(card_slug, feature_code, source_url, section)
  on mapping.card_slug = c.slug and mapping.feature_code = ft.code
join public.source_documents sd on sd.source_url = mapping.source_url
join public.source_citations sc on sc.source_document_id = sd.id and sc.section = mapping.section;

insert into public.card_feature_presentation_items (
  presentation_id, item_type, plain_language_text, feature_rule_id, feature_limit_id,
  sort_order, verification_status, verified_at
)
select
  cfp.id,
  seed.item_type,
  seed.plain_language_text,
  fr.id,
  fl.id,
  seed.sort_order,
  'VERIFIED',
  timestamptz '2026-09-17 00:00:00-04'
from public.card_feature_presentations cfp
join public.card_features cf on cf.id = cfp.card_feature_id
join public.card_versions cv on cv.id = cf.card_version_id and cv.status = 'CURRENT'
join public.cards c on c.id = cv.card_id
join public.feature_types ft on ft.id = cf.feature_type_id
join (
  values
    ('rbc-avion-visa-infinite', 'travel_emergency_medical', 1, 'CONDITION', 'RULE', 'canadian_resident', 'The insured person must be a permanent resident of Canada.'),
    ('rbc-avion-visa-infinite', 'travel_emergency_medical', 2, 'CONDITION', 'RULE', 'government_health_plan_active', 'The insured person must have active provincial or territorial government health coverage.'),
    ('rbc-avion-visa-infinite', 'travel_emergency_medical', 3, 'LIMITATION', 'LIMIT', 'maximum_trip_duration_under_65', 'For travellers under 65, coverage applies to the first 15 consecutive trip days.'),
    ('rbc-avion-visa-infinite', 'travel_emergency_medical', 4, 'LIMITATION', 'LIMIT', 'maximum_trip_duration_65_or_older', 'For travellers age 65 or older, coverage applies to the first 3 consecutive trip days.'),
    ('rbc-avion-visa-infinite', 'travel_emergency_medical', 5, 'LIMITATION', 'LIMIT', 'maximum_benefit', 'The maximum emergency medical benefit is unlimited unless the certificate says otherwise.'),
    ('rbc-avion-visa-infinite', 'travel_accident', 1, 'CONDITION', 'RULE', 'covered_person_relationship', 'The traveller must meet one of the certificate’s covered-person relationships.'),
    ('rbc-avion-visa-infinite', 'travel_accident', 2, 'CONDITION', 'RULE', 'common_carrier_fare_payment_percentage', 'The full common-carrier fare must be paid with the card and/or Avion points.'),
    ('rbc-avion-visa-infinite', 'travel_accident', 3, 'LIMITATION', 'LIMIT', 'maximum_specific_loss_indemnity', 'The maximum listed benefit for a specific covered loss is $500,000 CAD per covered person.'),
    ('rbc-avion-visa-infinite', 'rental_car_collision_damage', 1, 'CONDITION', 'RULE', 'rental_payment_percentage', 'The entire rental cost must be paid with the card and/or Avion points.'),
    ('rbc-avion-visa-infinite', 'rental_car_collision_damage', 2, 'CONDITION', 'RULE', 'rental_cdw_declined', 'The rental company’s collision or loss damage waiver must be declined for full primary coverage.'),
    ('rbc-avion-visa-infinite', 'rental_car_collision_damage', 3, 'LIMITATION', 'LIMIT', 'maximum_rental_duration', 'The rental period must be 48 consecutive days or less.'),
    ('rbc-avion-visa-infinite', 'rental_car_collision_damage', 4, 'LIMITATION', 'LIMIT', 'maximum_vehicle_msrp', 'Vehicles with a model-year MSRP over $65,000 CAD are excluded.'),
    ('rbc-avion-visa-infinite', 'rental_car_collision_damage', 5, 'CONDITION', 'RULE', 'rental_driver_authorized', 'Drivers must be licensed and authorized under the rental agreement and local law.'),
    ('rbc-avion-visa-infinite', 'trip_cancellation', 1, 'CONDITION', 'RULE', 'trip_payment_percentage', 'Eligible prepaid travel arrangements must be paid in full with the card and/or Avion points.'),
    ('rbc-avion-visa-infinite', 'trip_cancellation', 2, 'LIMITATION', 'LIMIT', 'per_person_limit', 'The maximum is $1,500 CAD per covered person per trip.'),
    ('rbc-avion-visa-infinite', 'trip_cancellation', 3, 'LIMITATION', 'LIMIT', 'overall_limit', 'The overall maximum is $5,000 CAD per trip for all covered persons.'),
    ('rbc-avion-visa-infinite', 'trip_interruption', 1, 'CONDITION', 'RULE', 'trip_payment_percentage', 'Eligible prepaid travel arrangements must be paid in full with the card and/or Avion points.'),
    ('rbc-avion-visa-infinite', 'trip_interruption', 2, 'LIMITATION', 'LIMIT', 'per_person_limit', 'The maximum is $5,000 CAD per covered person per trip.'),
    ('rbc-avion-visa-infinite', 'trip_interruption', 3, 'LIMITATION', 'LIMIT', 'overall_limit', 'The overall maximum is $25,000 CAD per trip for all covered persons.'),
    ('rbc-avion-visa-infinite', 'baggage_delay', 1, 'CONDITION', 'RULE', 'air_ticket_payment_percentage', 'The full airline-ticket cost must be paid with the card and/or Avion points.'),
    ('rbc-avion-visa-infinite', 'baggage_delay', 2, 'CONDITION', 'RULE', 'baggage_delay_hours', 'Checked baggage must be delayed for at least 4 hours.'),
    ('rbc-avion-visa-infinite', 'baggage_delay', 3, 'LIMITATION', 'LIMIT', 'per_occurrence_limit', 'Emergency-purchase reimbursement is limited to $500 CAD per occurrence.'),
    ('rbc-avion-visa-infinite', 'baggage_delay', 4, 'LIMITATION', 'LIMIT', 'overall_limit', 'The overall maximum is $2,500 CAD per occurrence for all covered persons.'),
    ('rbc-avion-visa-infinite', 'flight_delay', 1, 'CONDITION', 'RULE', 'air_ticket_payment_percentage', 'The full airline-ticket cost must be paid with the card and/or Avion points.'),
    ('rbc-avion-visa-infinite', 'flight_delay', 2, 'CONDITION', 'RULE', 'air_carrier_check_in', 'The insured person must have checked in with the airline.'),
    ('rbc-avion-visa-infinite', 'flight_delay', 3, 'CONDITION', 'RULE', 'flight_delay_hours', 'The qualifying delay must last at least 4 hours.'),
    ('rbc-avion-visa-infinite', 'flight_delay', 4, 'LIMITATION', 'LIMIT', 'per_day_limit', 'Eligible expenses are limited to $250 CAD per covered person per day.'),
    ('rbc-avion-visa-infinite', 'flight_delay', 5, 'LIMITATION', 'LIMIT', 'overall_limit', 'The overall maximum is $500 CAD per occurrence for all covered persons.'),
    ('rbc-avion-visa-infinite', 'hotel_motel_burglary', 1, 'CONDITION', 'RULE', 'forced_entry_burglary', 'The burglary must involve wrongful entry with visible signs of force.'),
    ('rbc-avion-visa-infinite', 'hotel_motel_burglary', 2, 'LIMITATION', 'LIMIT', 'per_occurrence_limit', 'Repair or replacement reimbursement is limited to $2,500 CAD per occurrence.'),
    ('rbc-avion-visa-infinite', 'purchase_protection', 1, 'CONDITION', 'RULE', 'item_payment_percentage', 'The item must be paid in full with the card and/or Avion points.'),
    ('rbc-avion-visa-infinite', 'purchase_protection', 2, 'LIMITATION', 'LIMIT', 'coverage_window', 'Purchase protection applies for 90 days from the purchase date.'),
    ('rbc-avion-visa-infinite', 'purchase_protection', 3, 'LIMITATION', 'LIMIT', 'annual_account_limit', 'The maximum is $50,000 CAD per account per calendar year.'),
    ('rbc-avion-visa-infinite', 'extended_warranty', 1, 'CONDITION', 'RULE', 'item_payment_percentage', 'The item must be paid in full with the card and/or Avion points.'),
    ('rbc-avion-visa-infinite', 'extended_warranty', 2, 'LIMITATION', 'LIMIT', 'maximum_extension', 'The manufacturer warranty may be extended by up to 1 additional year.'),
    ('rbc-avion-visa-infinite', 'extended_warranty', 3, 'LIMITATION', 'LIMIT', 'maximum_combined_warranty', 'The original and extended warranty periods cannot total more than 5 years.'),
    ('rbc-avion-visa-infinite', 'mobile_device_insurance', 1, 'CONDITION', 'RULE', 'device_payment_percentage', 'For an outright purchase, the full device price must be paid with the card and/or Avion points.'),
    ('rbc-avion-visa-infinite', 'mobile_device_insurance', 2, 'CONDITION', 'RULE', 'wireless_bill_payment', 'For a device financed through a wireless plan, every monthly wireless bill must be charged to the card.'),
    ('rbc-avion-visa-infinite', 'mobile_device_insurance', 3, 'LIMITATION', 'LIMIT', 'waiting_period', 'Coverage begins 91 days after purchase.'),
    ('rbc-avion-visa-infinite', 'mobile_device_insurance', 4, 'LIMITATION', 'LIMIT', 'coverage_window', 'Coverage ends 2 years after purchase.'),
    ('rbc-avion-visa-infinite', 'mobile_device_insurance', 5, 'LIMITATION', 'LIMIT', 'per_claim_limit', 'Reimbursement is limited to $1,500 CAD per claim before applicable depreciation and the deductible.'),
    ('rbc-avion-visa-infinite', 'mobile_device_insurance', 6, 'LIMITATION', 'LIMIT', 'claim_frequency_12_months', 'A maximum of 1 claim may be made in any 12 consecutive months.'),
    ('rbc-avion-visa-infinite', 'mobile_device_insurance', 7, 'LIMITATION', 'LIMIT', 'claim_frequency_48_months', 'A maximum of 2 claims may be made in any 48 consecutive months.'),
    ('rbc-avion-visa-infinite', 'mobile_device_insurance', 8, 'CONDITION', 'RULE', 'account_good_standing', 'The card account must remain open and not be 60 days past due.'),
    ('triangle-mastercard', 'installment_financing', 1, 'CONDITION', 'RULE', 'financing_plan_requested', 'The equal-payment plan must be requested.'),
    ('triangle-mastercard', 'installment_financing', 2, 'CONDITION', 'RULE', 'credit_approved', 'The financing request is subject to credit approval.'),
    ('triangle-mastercard', 'installment_financing', 3, 'CONDITION', 'RULE', 'triangle_card_payment', 'The qualifying purchase must be made with a Triangle credit card.'),
    ('triangle-mastercard', 'installment_financing', 4, 'CONDITION', 'RULE', 'purchase_qualifies', 'The purchase must qualify for the applicable financing offer.'),
    ('triangle-mastercard', 'installment_financing', 5, 'LIMITATION', 'LIMIT', 'minimum_qualifying_purchase', 'The standard minimum qualifying purchase is $150 CAD before tax unless another amount is stated.'),
    ('triangle-mastercard', 'installment_financing', 6, 'CONDITION', 'RULE', 'participating_financing_retailer', 'The purchase must be made at a participating retailer.'),
    ('triangle-mastercard', 'installment_financing', 7, 'LIMITATION', 'RULE', 'gift_card_purchase', 'Gift-card purchases are excluded.'),
    ('triangle-mastercard', 'installment_financing', 8, 'LIMITATION', 'LIMIT', 'standard_plan_duration', 'The standard payment-plan term is 24 months unless another term is stated.'),
    ('triangle-mastercard', 'installment_financing', 9, 'CONDITION', 'LIMIT', 'plan_interest_rate', 'Interest does not accrue during a qualifying plan.'),
    ('triangle-mastercard', 'installment_financing', 10, 'CONDITION', 'LIMIT', 'administration_fee', 'There is no administration fee to enter a special payment plan.'),
    ('triangle-mastercard', 'installment_financing', 11, 'CONDITION', 'RULE', 'monthly_installment_paid', 'Each monthly plan instalment must be paid in full by its due date.'),
    ('triangle-mastercard', 'installment_financing', 12, 'LIMITATION', 'LIMIT', 'payment_default_threshold', 'The plan ends if the full minimum payment remains unpaid 59 days after the statement date.'),
    ('triangle-mastercard', 'points_redemption', 1, 'CONDITION', 'RULE', 'triangle_rewards_membership', 'The customer must be enrolled in Triangle Rewards or use an activated eligible program payment card.'),
    ('triangle-mastercard', 'points_redemption', 2, 'CONDITION', 'RULE', 'participating_redemption_retailer', 'CT Money can be redeemed only at participating Triangle retailers.'),
    ('triangle-mastercard', 'points_redemption', 3, 'CONDITION', 'RULE', 'accepted_redemption_method', 'An accepted card, app, or approved cardless method must be presented.'),
    ('triangle-mastercard', 'points_redemption', 4, 'LIMITATION', 'RULE', 'same_transaction_reward', 'CT Money earned on a transaction cannot be redeemed on that same transaction.'),
    ('triangle-mastercard', 'points_redemption', 5, 'LIMITATION', 'RULE', 'triangle_ecosystem_redemption', 'CT Money is redeemed within the Triangle retail ecosystem, not as bank cash or a statement credit.'),
    ('triangle-mastercard', 'points_redemption', 6, 'CONDITION', 'LIMIT', 'redemption_value', '$1 in CT Money has $1 CAD in redemption value.'),
    ('triangle-mastercard', 'points_redemption', 7, 'LIMITATION', 'RULE', 'redemption_exclusions_apply', 'Other merchant, item, and program redemption exclusions may apply.')
) as seed(card_slug, feature_code, sort_order, item_type, anchor_type, anchor_key, plain_language_text)
  on seed.card_slug = c.slug and seed.feature_code = ft.code
left join public.feature_rules fr
  on seed.anchor_type = 'RULE' and fr.card_feature_id = cf.id and fr.rule_key = seed.anchor_key
left join public.feature_limits fl
  on seed.anchor_type = 'LIMIT' and fl.card_feature_id = cf.id and fl.limit_type = seed.anchor_key
where (seed.anchor_type = 'RULE' and fr.id is not null)
   or (seed.anchor_type = 'LIMIT' and fl.id is not null);

do $$
declare
  presentation_count integer;
  rbc_presentation_count integer;
  triangle_presentation_count integer;
  presentation_item_count integer;
  presentation_citation_count integer;
  uncited_verified_presentations integer;
  invalid_item_anchors integer;
  unverified_item_facts integer;
  unexpected_cards integer;
  unexpected_feature_count integer;
  presentations_without_items integer;
begin
  select count(*) into presentation_count
  from public.card_feature_presentations;

  select count(*) into rbc_presentation_count
  from public.card_feature_presentations cfp
  join public.card_features cf on cf.id = cfp.card_feature_id
  join public.card_versions cv on cv.id = cf.card_version_id and cv.status = 'CURRENT'
  join public.cards c on c.id = cv.card_id
  where c.slug = 'rbc-avion-visa-infinite';

  select count(*) into triangle_presentation_count
  from public.card_feature_presentations cfp
  join public.card_features cf on cf.id = cfp.card_feature_id
  join public.card_versions cv on cv.id = cf.card_version_id and cv.status = 'CURRENT'
  join public.cards c on c.id = cv.card_id
  where c.slug = 'triangle-mastercard';

  select count(*) into presentation_item_count
  from public.card_feature_presentation_items;

  select count(*) into presentation_citation_count
  from public.card_feature_presentation_citations;

  select count(*) into uncited_verified_presentations
  from (
    select cfp.id
    from public.card_feature_presentations cfp
    left join public.card_feature_presentation_citations cfpc on cfpc.presentation_id = cfp.id
    where cfp.verification_status = 'VERIFIED'
    group by cfp.id
    having count(cfpc.citation_id) = 0
  ) uncited;

  select count(*) into presentations_without_items
  from (
    select cfp.id
    from public.card_feature_presentations cfp
    left join public.card_feature_presentation_items cfpi on cfpi.presentation_id = cfp.id
    group by cfp.id
    having count(cfpi.id) = 0
  ) empty_presentations;

  select count(*) into invalid_item_anchors
  from public.card_feature_presentation_items cfpi
  join public.card_feature_presentations cfp on cfp.id = cfpi.presentation_id
  left join public.feature_rules fr on fr.id = cfpi.feature_rule_id
  left join public.feature_limits fl on fl.id = cfpi.feature_limit_id
  where coalesce(fr.card_feature_id, fl.card_feature_id) <> cfp.card_feature_id;

  select count(*) into unverified_item_facts
  from public.card_feature_presentation_items cfpi
  left join public.feature_rules fr on fr.id = cfpi.feature_rule_id
  left join public.feature_limits fl on fl.id = cfpi.feature_limit_id
  where cfpi.verification_status = 'VERIFIED'
    and coalesce(fr.verification_status, fl.verification_status) <> 'VERIFIED';

  select count(*) into unexpected_cards
  from public.card_feature_presentations cfp
  join public.card_features cf on cf.id = cfp.card_feature_id
  join public.card_versions cv on cv.id = cf.card_version_id
  join public.cards c on c.id = cv.card_id
  where c.slug not in ('rbc-avion-visa-infinite', 'triangle-mastercard');

  select count(*) into unexpected_feature_count
  from public.card_feature_presentations cfp
  join public.card_features cf on cf.id = cfp.card_feature_id
  join public.card_versions cv on cv.id = cf.card_version_id
  join public.cards c on c.id = cv.card_id
  join public.feature_types ft on ft.id = cf.feature_type_id
  where not (
    c.slug = 'rbc-avion-visa-infinite'
    and ft.code in (
      'travel_emergency_medical', 'travel_accident', 'rental_car_collision_damage',
      'trip_cancellation', 'trip_interruption', 'baggage_delay', 'flight_delay',
      'hotel_motel_burglary', 'purchase_protection', 'extended_warranty',
      'mobile_device_insurance'
    )
  )
  and not (
    c.slug = 'triangle-mastercard'
    and ft.code in ('installment_financing', 'points_redemption')
  );

  if presentation_count <> 13 or rbc_presentation_count <> 11 or triangle_presentation_count <> 2 then
    raise exception 'Step 22.1A expected 13 presentations (11 RBC, 2 Triangle), found % (%, %)',
      presentation_count, rbc_presentation_count, triangle_presentation_count;
  end if;

  if presentation_item_count <> 63 then
    raise exception 'Step 22.1A expected 63 presentation items, found %', presentation_item_count;
  end if;

  if presentation_citation_count <> 19 then
    raise exception 'Step 22.1A expected 19 presentation citation mappings, found %', presentation_citation_count;
  end if;

  if uncited_verified_presentations <> 0 then
    raise exception 'Step 22.1A found % VERIFIED presentations without citations', uncited_verified_presentations;
  end if;

  if presentations_without_items <> 0 then
    raise exception 'Step 22.1A found % presentations without condition or limitation items', presentations_without_items;
  end if;

  if invalid_item_anchors <> 0 then
    raise exception 'Step 22.1A found % cross-feature presentation-item anchors', invalid_item_anchors;
  end if;

  if unverified_item_facts <> 0 then
    raise exception 'Step 22.1A found % VERIFIED items backed by unverified facts', unverified_item_facts;
  end if;

  if unexpected_cards <> 0 or unexpected_feature_count <> 0 then
    raise exception 'Step 22.1A created presentation data for unintended cards/features: % cards, % features',
      unexpected_cards, unexpected_feature_count;
  end if;
end
$$;

commit;
