-- Billing moves from Paddle to Stripe. Nothing could be bought under Paddle: the only row was the
-- hand-made $0 test purchase txn_v0testocean01, so the three billing tables are rebuilt with Stripe
-- ids rather than migrated. Entitlements are untouched (the test account keeps its packs): for a
-- Stripe purchase, entitlements.source_id is the Checkout Session id.
-- Everything here is written only by the verified Stripe webhook with the service role.

drop table public.transactions;
drop table public.subscriptions;
drop table public.billing_customers;

create table public.billing_customers (
  parent_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text not null unique check (stripe_customer_id ~ '^cus_[A-Za-z0-9]+$'),
  created_at timestamptz not null default now()
);

-- Unused today: every purchase is one-time. Kept so a subscription could come back later.
create table public.subscriptions (
  stripe_subscription_id text primary key check (stripe_subscription_id ~ '^sub_[A-Za-z0-9]+$'),
  stripe_customer_id text not null references public.billing_customers (stripe_customer_id) on delete cascade,
  status text not null check (status in ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'unpaid', 'paused', 'canceled')),
  price_id text not null check (price_id ~ '^price_[A-Za-z0-9]+$'),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  last_event_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index subscriptions_customer_idx on public.subscriptions (stripe_customer_id);

-- One row per paid Checkout Session. Deleting a parent unlinks the row instead of deleting it:
-- what stays is the session and payment ids, the packs, amount, currency, date and status.
create table public.transactions (
  stripe_checkout_session_id text primary key check (stripe_checkout_session_id ~ '^cs_(test|live)_[A-Za-z0-9]+$'),
  stripe_payment_intent_id text unique check (stripe_payment_intent_id ~ '^pi_[A-Za-z0-9]+$'),
  stripe_customer_id text references public.billing_customers (stripe_customer_id) on delete set null,
  pack_ids text[] not null check (cardinality(pack_ids) between 1 and 40),
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null check (status in ('paid', 'refunded')),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index transactions_customer_idx on public.transactions (stripe_customer_id);

comment on column public.transactions.stripe_customer_id is
  'Null once the parent account is deleted. The payment record itself is kept for accounting.';

alter table public.billing_customers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.transactions enable row level security;

revoke all on public.billing_customers, public.subscriptions, public.transactions from anon, authenticated;
grant select on public.billing_customers, public.subscriptions, public.transactions to authenticated;

create policy billing_customers_select_own on public.billing_customers
  for select to authenticated using ((select auth.uid()) = parent_id);

create policy subscriptions_select_own on public.subscriptions
  for select to authenticated using (
    exists (select 1 from public.billing_customers b
            where b.stripe_customer_id = subscriptions.stripe_customer_id
              and b.parent_id = (select auth.uid()))
  );

create policy transactions_select_own on public.transactions
  for select to authenticated using (
    exists (select 1 from public.billing_customers b
            where b.stripe_customer_id = transactions.stripe_customer_id
              and b.parent_id = (select auth.uid()))
  );

-- Records one paid Checkout Session and grants its packs, all or nothing. Safe to call again for
-- the same session (Stripe retries webhooks): every insert skips rows that already exist.
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
begin
  if p_customer_id is not null then
    insert into public.billing_customers (parent_id, stripe_customer_id)
    values (p_parent_id, p_customer_id)
    on conflict (parent_id) do nothing;
  end if;

  insert into public.transactions (
    stripe_checkout_session_id, stripe_payment_intent_id, stripe_customer_id,
    pack_ids, amount_minor, currency, status, occurred_at
  ) values (
    p_session_id, p_payment_intent_id,
    (select b.stripe_customer_id from public.billing_customers b where b.parent_id = p_parent_id),
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
