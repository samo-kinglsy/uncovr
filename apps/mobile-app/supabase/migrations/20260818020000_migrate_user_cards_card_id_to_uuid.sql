begin;

alter table public.user_cards
add column card_uuid uuid;

update public.user_cards as user_cards
set card_uuid = cards.id
from public.cards as cards
where user_cards.card_id = cards.slug;

do $$
declare
  unmapped_count bigint;
begin
  select count(*)
  into unmapped_count
  from public.user_cards
  where card_uuid is null;

  if unmapped_count > 0 then
    raise exception
      'Cannot migrate user_cards.card_id: % existing row(s) do not match cards.slug',
      unmapped_count;
  end if;
end;
$$;

alter table public.user_cards
drop constraint user_cards_user_id_card_id_key;

alter table public.user_cards
drop column card_id;

alter table public.user_cards
rename column card_uuid to card_id;

alter table public.user_cards
alter column card_id set not null;

alter table public.user_cards
add constraint user_cards_card_id_fkey
foreign key (card_id) references public.cards (id) on delete restrict;

alter table public.user_cards
add constraint user_cards_user_id_card_id_key unique (user_id, card_id);

create index user_cards_card_id_idx on public.user_cards (card_id);

commit;
