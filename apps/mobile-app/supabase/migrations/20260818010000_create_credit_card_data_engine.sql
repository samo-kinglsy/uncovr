begin;

create table public.issuers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  country_code char(2) not null default 'CA',
  official_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  issuer_id uuid not null references public.issuers (id) on delete restrict,
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (issuer_id, slug)
);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  issuer_id uuid not null references public.issuers (id) on delete restrict,
  brand_id uuid references public.brands (id) on delete restrict,
  name text not null,
  slug text not null unique,
  network text not null,
  network_tier text,
  country_code char(2) not null default 'CA',
  card_type text not null default 'personal',
  rewards_program text,
  official_product_url text,
  image_url text,
  status text not null,
  first_seen_at timestamptz,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.card_versions (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id) on delete cascade,
  version_number integer not null,
  effective_from date not null,
  effective_to date,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (card_id, version_number),
  check (effective_to is null or effective_to > effective_from)
);

create table public.benefit_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  sort_order integer
);

create table public.feature_types (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.benefit_categories (id) on delete restrict,
  code text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.card_features (
  id uuid primary key default gen_random_uuid(),
  card_version_id uuid not null references public.card_versions (id) on delete cascade,
  feature_type_id uuid not null references public.feature_types (id) on delete restrict,
  summary text,
  delivery_type text,
  provider_name text,
  insurer_name text,
  effective_from date,
  effective_to date,
  verification_status text not null,
  risk_level text not null,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (verification_status in ('DRAFT', 'VERIFIED', 'REVIEW_REQUIRED', 'SOURCE_CONFLICT')),
  check (risk_level in ('LOW', 'MEDIUM', 'HIGH')),
  check (effective_to is null or effective_from is null or effective_to > effective_from)
);

create table public.evaluation_inputs (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  data_type text not null,
  question_text text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.feature_rules (
  id uuid primary key default gen_random_uuid(),
  card_feature_id uuid not null references public.card_features (id) on delete cascade,
  rule_category text not null,
  rule_effect text not null,
  rule_key text not null,
  operator text not null,
  value_json jsonb,
  unit text,
  human_description text,
  risk_level text not null,
  verification_status text not null,
  effective_from date,
  effective_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (rule_effect in ('MUST_MATCH', 'MUST_NOT_MATCH', 'INFORMATIONAL')),
  check (risk_level in ('LOW', 'MEDIUM', 'HIGH')),
  check (verification_status in ('DRAFT', 'VERIFIED', 'REVIEW_REQUIRED', 'SOURCE_CONFLICT')),
  check (effective_to is null or effective_from is null or effective_to > effective_from)
);

create table public.rule_inputs (
  rule_id uuid references public.feature_rules (id) on delete cascade,
  evaluation_input_id uuid references public.evaluation_inputs (id) on delete cascade,
  required boolean not null default true,
  primary key (rule_id, evaluation_input_id)
);

create table public.rule_groups (
  id uuid primary key default gen_random_uuid(),
  card_feature_id uuid not null references public.card_features (id) on delete cascade,
  operator text not null,
  parent_group_id uuid references public.rule_groups (id) on delete cascade,
  description text,
  check (operator in ('AND', 'OR'))
);

create table public.rule_group_members (
  id uuid primary key default gen_random_uuid(),
  rule_group_id uuid not null references public.rule_groups (id) on delete cascade,
  rule_id uuid references public.feature_rules (id) on delete cascade,
  child_group_id uuid references public.rule_groups (id) on delete cascade,
  sort_order integer,
  check ((rule_id is null) <> (child_group_id is null))
);

create table public.feature_limits (
  id uuid primary key default gen_random_uuid(),
  card_feature_id uuid not null references public.card_features (id) on delete cascade,
  limit_type text not null,
  amount numeric,
  currency char(3),
  quantity numeric,
  unit text,
  period text,
  description text,
  verification_status text not null,
  risk_level text not null,
  effective_from date,
  effective_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (verification_status in ('DRAFT', 'VERIFIED', 'REVIEW_REQUIRED', 'SOURCE_CONFLICT')),
  check (risk_level in ('LOW', 'MEDIUM', 'HIGH')),
  check (effective_to is null or effective_from is null or effective_to > effective_from)
);

create table public.source_documents (
  id uuid primary key default gen_random_uuid(),
  issuer_id uuid not null references public.issuers (id) on delete restrict,
  source_type text not null,
  title text not null,
  source_url text not null,
  storage_path text,
  document_version text,
  effective_date date,
  authority_level integer not null,
  document_hash text,
  retrieved_at timestamptz,
  last_checked_at timestamptz,
  source_status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    source_status in (
      'VERIFIED_CURRENT',
      'CHANGE_DETECTED',
      'REVIEW_REQUIRED',
      'SOURCE_UNAVAILABLE',
      'STALE'
    )
  )
);

create table public.card_sources (
  card_id uuid references public.cards (id) on delete cascade,
  source_document_id uuid references public.source_documents (id) on delete cascade,
  primary key (card_id, source_document_id)
);

create table public.source_citations (
  id uuid primary key default gen_random_uuid(),
  source_document_id uuid not null references public.source_documents (id) on delete cascade,
  page_number integer,
  section text,
  evidence_text text,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.feature_rule_citations (
  rule_id uuid references public.feature_rules (id) on delete cascade,
  citation_id uuid references public.source_citations (id) on delete cascade,
  primary key (rule_id, citation_id)
);

create table public.feature_limit_citations (
  feature_limit_id uuid references public.feature_limits (id) on delete cascade,
  citation_id uuid references public.source_citations (id) on delete cascade,
  primary key (feature_limit_id, citation_id)
);

create table public.card_feature_citations (
  card_feature_id uuid references public.card_features (id) on delete cascade,
  citation_id uuid references public.source_citations (id) on delete cascade,
  primary key (card_feature_id, citation_id)
);

create index cards_issuer_id_idx on public.cards (issuer_id);
create index cards_brand_id_idx on public.cards (brand_id);
create index cards_status_idx on public.cards (status);
create index card_versions_card_id_idx on public.card_versions (card_id);
create unique index card_versions_one_current_per_card_idx
on public.card_versions (card_id)
where status = 'CURRENT';
create index card_features_card_version_id_idx on public.card_features (card_version_id);
create index card_features_feature_type_id_idx on public.card_features (feature_type_id);
create index feature_rules_card_feature_id_idx on public.feature_rules (card_feature_id);
create index feature_limits_card_feature_id_idx on public.feature_limits (card_feature_id);
create index rule_inputs_rule_id_idx on public.rule_inputs (rule_id);
create index rule_inputs_evaluation_input_id_idx on public.rule_inputs (evaluation_input_id);
create index card_sources_card_id_idx on public.card_sources (card_id);
create index card_sources_source_document_id_idx on public.card_sources (source_document_id);
create index source_citations_source_document_id_idx on public.source_citations (source_document_id);

alter table public.issuers enable row level security;
alter table public.brands enable row level security;
alter table public.cards enable row level security;
alter table public.card_versions enable row level security;
alter table public.benefit_categories enable row level security;
alter table public.feature_types enable row level security;
alter table public.card_features enable row level security;
alter table public.evaluation_inputs enable row level security;
alter table public.feature_rules enable row level security;
alter table public.rule_inputs enable row level security;
alter table public.rule_groups enable row level security;
alter table public.rule_group_members enable row level security;
alter table public.feature_limits enable row level security;
alter table public.source_documents enable row level security;
alter table public.card_sources enable row level security;
alter table public.source_citations enable row level security;
alter table public.feature_rule_citations enable row level security;
alter table public.feature_limit_citations enable row level security;
alter table public.card_feature_citations enable row level security;

revoke all on table
  public.issuers,
  public.brands,
  public.cards,
  public.card_versions,
  public.benefit_categories,
  public.feature_types,
  public.card_features,
  public.evaluation_inputs,
  public.feature_rules,
  public.rule_inputs,
  public.rule_groups,
  public.rule_group_members,
  public.feature_limits,
  public.source_documents,
  public.card_sources,
  public.source_citations,
  public.feature_rule_citations,
  public.feature_limit_citations,
  public.card_feature_citations
from anon, authenticated;

grant select on table
  public.issuers,
  public.brands,
  public.cards,
  public.card_versions,
  public.benefit_categories,
  public.feature_types,
  public.card_features,
  public.evaluation_inputs,
  public.feature_rules,
  public.rule_inputs,
  public.rule_groups,
  public.rule_group_members,
  public.feature_limits,
  public.source_documents,
  public.card_sources,
  public.source_citations,
  public.feature_rule_citations,
  public.feature_limit_citations,
  public.card_feature_citations
to authenticated;

create policy "Authenticated users can read issuers"
on public.issuers for select to authenticated using (true);
create policy "Authenticated users can read brands"
on public.brands for select to authenticated using (true);
create policy "Authenticated users can read cards"
on public.cards for select to authenticated using (true);
create policy "Authenticated users can read card versions"
on public.card_versions for select to authenticated using (true);
create policy "Authenticated users can read benefit categories"
on public.benefit_categories for select to authenticated using (true);
create policy "Authenticated users can read feature types"
on public.feature_types for select to authenticated using (true);
create policy "Authenticated users can read card features"
on public.card_features for select to authenticated using (true);
create policy "Authenticated users can read evaluation inputs"
on public.evaluation_inputs for select to authenticated using (true);
create policy "Authenticated users can read feature rules"
on public.feature_rules for select to authenticated using (true);
create policy "Authenticated users can read rule inputs"
on public.rule_inputs for select to authenticated using (true);
create policy "Authenticated users can read rule groups"
on public.rule_groups for select to authenticated using (true);
create policy "Authenticated users can read rule group members"
on public.rule_group_members for select to authenticated using (true);
create policy "Authenticated users can read feature limits"
on public.feature_limits for select to authenticated using (true);
create policy "Authenticated users can read source documents"
on public.source_documents for select to authenticated using (true);
create policy "Authenticated users can read card sources"
on public.card_sources for select to authenticated using (true);
create policy "Authenticated users can read source citations"
on public.source_citations for select to authenticated using (true);
create policy "Authenticated users can read feature rule citations"
on public.feature_rule_citations for select to authenticated using (true);
create policy "Authenticated users can read feature limit citations"
on public.feature_limit_citations for select to authenticated using (true);
create policy "Authenticated users can read card feature citations"
on public.card_feature_citations for select to authenticated using (true);

insert into public.issuers (name, slug)
values
  ('Royal Bank of Canada', 'rbc'),
  ('The Toronto-Dominion Bank', 'td'),
  ('The Bank of Nova Scotia', 'scotiabank'),
  ('American Express Canada', 'american-express'),
  ('Canadian Tire Bank', 'canadian-tire-bank'),
  ('Canadian Imperial Bank of Commerce', 'cibc');

insert into public.brands (issuer_id, name, slug)
select id, 'Triangle', 'triangle'
from public.issuers
where slug = 'canadian-tire-bank';

insert into public.benefit_categories (code, name, sort_order)
values
  ('insurance', 'Insurance', 10),
  ('protection', 'Protection', 20),
  ('travel_perks', 'Travel perks', 30),
  ('rewards', 'Rewards', 40),
  ('lifestyle_perks', 'Lifestyle perks', 50),
  ('financial_features', 'Financial features', 60);

insert into public.feature_types (category_id, code, name)
values
  ((select id from public.benefit_categories where code = 'insurance'), 'travel_emergency_medical', 'Travel emergency medical'),
  ((select id from public.benefit_categories where code = 'insurance'), 'trip_cancellation', 'Trip cancellation'),
  ((select id from public.benefit_categories where code = 'insurance'), 'trip_interruption', 'Trip interruption'),
  ((select id from public.benefit_categories where code = 'insurance'), 'rental_car_collision_damage', 'Rental car collision damage'),
  ((select id from public.benefit_categories where code = 'insurance'), 'flight_delay', 'Flight delay'),
  ((select id from public.benefit_categories where code = 'insurance'), 'baggage_delay', 'Baggage delay'),
  ((select id from public.benefit_categories where code = 'protection'), 'purchase_protection', 'Purchase protection'),
  ((select id from public.benefit_categories where code = 'protection'), 'extended_warranty', 'Extended warranty'),
  ((select id from public.benefit_categories where code = 'insurance'), 'mobile_device_insurance', 'Mobile device insurance'),
  ((select id from public.benefit_categories where code = 'protection'), 'price_protection', 'Price protection'),
  ((select id from public.benefit_categories where code = 'travel_perks'), 'airport_lounge_access', 'Airport lounge access'),
  ((select id from public.benefit_categories where code = 'travel_perks'), 'free_checked_baggage', 'Free checked baggage'),
  ((select id from public.benefit_categories where code = 'travel_perks'), 'nexus_credit', 'NEXUS credit'),
  ((select id from public.benefit_categories where code = 'lifestyle_perks'), 'roadside_assistance', 'Roadside assistance'),
  ((select id from public.benefit_categories where code = 'rewards'), 'points_earning', 'Points earning'),
  ((select id from public.benefit_categories where code = 'rewards'), 'cashback_earning', 'Cashback earning'),
  ((select id from public.benefit_categories where code = 'rewards'), 'points_redemption', 'Points redemption'),
  ((select id from public.benefit_categories where code = 'financial_features'), 'no_foreign_transaction_fee', 'No foreign transaction fee'),
  ((select id from public.benefit_categories where code = 'financial_features'), 'installment_financing', 'Installment financing');

insert into public.evaluation_inputs (code, name, data_type)
values
  ('rental_duration_days', 'Rental duration', 'number'),
  ('payment_method', 'Payment method', 'string'),
  ('traveller_age', 'Traveller age', 'number'),
  ('vehicle_type', 'Vehicle type', 'string'),
  ('vehicle_value', 'Vehicle value', 'currency'),
  ('purchase_date', 'Purchase date', 'date'),
  ('incident_type', 'Incident type', 'string'),
  ('medical_history', 'Medical history', 'boolean');

insert into public.cards (
  issuer_id,
  brand_id,
  name,
  slug,
  network,
  network_tier,
  status
)
values
  (
    (select id from public.issuers where slug = 'rbc'),
    null,
    'RBC Avion Visa Infinite',
    'rbc-avion-visa-infinite',
    'Visa',
    'Infinite',
    'ACTIVE'
  ),
  (
    (select id from public.issuers where slug = 'td'),
    null,
    'TD Aeroplan Visa Infinite',
    'td-aeroplan-visa-infinite',
    'Visa',
    'Infinite',
    'ACTIVE'
  ),
  (
    (select id from public.issuers where slug = 'scotiabank'),
    null,
    'Scotiabank Passport Visa Infinite',
    'scotiabank-passport-visa-infinite',
    'Visa',
    'Infinite',
    'ACTIVE'
  ),
  (
    (select id from public.issuers where slug = 'american-express'),
    null,
    'American Express Cobalt Card',
    'amex-cobalt',
    'American Express',
    null,
    'ACTIVE'
  ),
  (
    (select id from public.issuers where slug = 'canadian-tire-bank'),
    (select id from public.brands where slug = 'triangle'),
    'Triangle Mastercard',
    'triangle-mastercard',
    'Mastercard',
    null,
    'ACTIVE'
  ),
  (
    (select id from public.issuers where slug = 'cibc'),
    null,
    'CIBC Adapta Mastercard',
    'cibc-adapta-mastercard',
    'Mastercard',
    null,
    'ACTIVE'
  ),
  (
    (select id from public.issuers where slug = 'cibc'),
    null,
    'CIBC Adapta World Mastercard',
    'cibc-adapta-world-mastercard',
    'Mastercard',
    'World',
    'ACTIVE'
  );

insert into public.card_versions (card_id, version_number, effective_from, status)
select id, 1, date '2026-08-18', 'CURRENT'
from public.cards
where slug in (
  'rbc-avion-visa-infinite',
  'td-aeroplan-visa-infinite',
  'scotiabank-passport-visa-infinite',
  'amex-cobalt',
  'triangle-mastercard',
  'cibc-adapta-mastercard',
  'cibc-adapta-world-mastercard'
);

commit;
