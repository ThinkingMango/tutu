-- Stripe goes live in production while previews stay on test keys, and both share this database.
-- A Stripe customer only exists in the mode that created it, so a parent now has at most one
-- customer per mode. Existing customers all came from test mode. Transactions show their mode too,
-- read from the Checkout Session id, so test purchases are never counted as real revenue.

alter table public.billing_customers add column livemode boolean not null default false;
alter table public.billing_customers drop constraint billing_customers_pkey;
alter table public.billing_customers add primary key (parent_id, livemode);

alter table public.transactions
  add column livemode boolean generated always as (left(stripe_checkout_session_id, 8) = 'cs_live_') stored;

create or replace function public.fulfil_checkout_session(
  p_session_id text,
  p_payment_intent_id text,
  p_customer_id text,
  p_parent_id uuid,
  p_pack_ids text[],
  p_amount_minor bigint,
  p_currency text,
  p_occurred_at timestamptz
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_livemode boolean := left(p_session_id, 8) = 'cs_live_';
begin
  if p_customer_id is not null then
    insert into public.billing_customers (parent_id, livemode, stripe_customer_id)
    values (p_parent_id, v_livemode, p_customer_id)
    on conflict (parent_id, livemode) do nothing;
  end if;

  insert into public.transactions (
    stripe_checkout_session_id, stripe_payment_intent_id, stripe_customer_id,
    pack_ids, amount_minor, currency, status, occurred_at
  ) values (
    p_session_id, p_payment_intent_id,
    (select b.stripe_customer_id from public.billing_customers b
     where b.parent_id = p_parent_id and b.livemode = v_livemode),
    p_pack_ids, p_amount_minor, upper(p_currency), 'paid', p_occurred_at
  )
  on conflict (stripe_checkout_session_id) do nothing;

  insert into public.entitlements (parent_id, scope, pack_id, source_type, source_id)
  select distinct p_parent_id, 'pack', ids.pack_id, 'transaction', p_session_id
  from unnest(p_pack_ids) as ids(pack_id)
  where not exists (
    select 1 from public.entitlements e
    where e.parent_id = p_parent_id and e.pack_id = ids.pack_id and e.source_id = p_session_id
  );
end;
$$;

revoke all on function public.fulfil_checkout_session(text, text, text, uuid, text[], bigint, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.fulfil_checkout_session(text, text, text, uuid, text[], bigint, text, timestamptz)
  to service_role;
