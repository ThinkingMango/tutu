-- Day 3: parent accounts, consent, private artwork, and server-only billing rights.
-- Every exposed table has RLS on. Ordinary users can never write billing or consent rows directly.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Parent profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  language text not null default 'en' check (language in ('en')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (language) on public.profiles to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Consent notices (versioned; an approved notice's wording can never change)
-- ---------------------------------------------------------------------------
create table public.consent_notices (
  version integer primary key check (version > 0),
  purpose text not null check (purpose in ('cloud_artwork_sync')),
  title text not null check (length(title) between 1 and 200),
  body text not null check (length(body) between 1 and 20000),
  body_sha256 text not null check (body_sha256 ~ '^[0-9a-f]{64}$'),
  approved_at timestamptz,
  approved_by text,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  check ((approved_at is null) = (approved_by is null)),
  check (retired_at is null or approved_at is not null)
);

alter table public.consent_notices enable row level security;
revoke all on public.consent_notices from anon, authenticated;
grant select on public.consent_notices to anon, authenticated;

create policy consent_notices_read_approved on public.consent_notices
  for select to anon, authenticated using (approved_at is not null);

create function private.guard_consent_notice()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.body_sha256 <> encode(sha256(convert_to(new.body, 'UTF8')), 'hex') then
    raise exception 'body_sha256 does not match body';
  end if;
  if tg_op = 'UPDATE' and old.approved_at is not null and (
    new.version <> old.version or new.purpose <> old.purpose or new.title <> old.title
    or new.body <> old.body or new.approved_at <> old.approved_at or new.approved_by <> old.approved_by
  ) then
    raise exception 'approved consent notices are immutable; publish a new version instead';
  end if;
  return new;
end;
$$;

create trigger consent_notices_guard
  before insert or update on public.consent_notices
  for each row execute function private.guard_consent_notice();

create function private.block_notice_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.approved_at is not null then
    raise exception 'approved consent notices cannot be deleted; retire them instead';
  end if;
  return old;
end;
$$;

create trigger consent_notices_no_delete
  before delete on public.consent_notices
  for each row execute function private.block_notice_delete();

-- ---------------------------------------------------------------------------
-- Consent records (written only by the consent functions below)
-- ---------------------------------------------------------------------------
create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references auth.users (id) on delete cascade,
  purpose text not null check (purpose in ('cloud_artwork_sync')),
  notice_version integer not null references public.consent_notices (version),
  verification_method text not null check (verification_method in ('email_link_recent_sign_in')),
  verification_reference text not null check (length(verification_reference) between 1 and 200),
  given_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  check (withdrawn_at is null or withdrawn_at >= given_at)
);

create unique index consent_records_one_active
  on public.consent_records (parent_id, purpose) where withdrawn_at is null;
create index consent_records_parent_idx on public.consent_records (parent_id);

alter table public.consent_records enable row level security;
revoke all on public.consent_records from anon, authenticated;
grant select on public.consent_records to authenticated;

create policy consent_records_select_own on public.consent_records
  for select to authenticated using ((select auth.uid()) = parent_id);

-- True when the signed-in parent has an active consent to the current, approved notice.
-- Runs as the caller: both tables it reads are visible to that parent under RLS.
create function public.has_cloud_consent()
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.consent_records c
    join public.consent_notices n on n.version = c.notice_version
    where c.parent_id = (select auth.uid())
      and c.purpose = 'cloud_artwork_sync'
      and c.withdrawn_at is null
      and n.approved_at is not null
      and n.retired_at is null
  );
$$;

revoke all on function public.has_cloud_consent() from public, anon;
grant execute on function public.has_cloud_consent() to authenticated;

-- Gives consent. Requires a sign-in from the last 10 minutes (read from the verified token's
-- amr claim), so an already-open session on a family tablet cannot consent on its own.
create function public.give_cloud_consent(p_notice_version integer)
returns public.consent_records
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_claims jsonb := auth.jwt();
  v_last_sign_in timestamptz;
  v_row public.consent_records;
begin
  if v_uid is null or coalesce((v_claims ->> 'is_anonymous')::boolean, false) then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;

  select max(to_timestamp((entry ->> 'timestamp')::bigint))
    into v_last_sign_in
    from jsonb_array_elements(coalesce(v_claims -> 'amr', '[]'::jsonb)) as entry;

  if v_last_sign_in is null or v_last_sign_in < now() - interval '10 minutes' then
    raise exception 'recent_sign_in_required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.consent_notices n
    where n.version = p_notice_version
      and n.purpose = 'cloud_artwork_sync'
      and n.approved_at is not null
      and n.retired_at is null
  ) then
    raise exception 'notice_not_available' using errcode = '22023';
  end if;

  select * into v_row from public.consent_records
    where parent_id = v_uid and purpose = 'cloud_artwork_sync' and withdrawn_at is null;

  if found and v_row.notice_version = p_notice_version then
    return v_row;
  end if;

  update public.consent_records set withdrawn_at = now()
    where parent_id = v_uid and purpose = 'cloud_artwork_sync' and withdrawn_at is null;

  insert into public.consent_records (parent_id, purpose, notice_version, verification_method, verification_reference)
    values (
      v_uid,
      'cloud_artwork_sync',
      p_notice_version,
      'email_link_recent_sign_in',
      'session:' || coalesce(v_claims ->> 'session_id', 'unknown') || ';signed_in_at:' || v_last_sign_in::text
    )
    returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.give_cloud_consent(integer) from public, anon;
grant execute on function public.give_cloud_consent(integer) to authenticated;

-- Withdrawing never needs a fresh sign-in: turning cloud saving off must always be easy.
create function public.withdraw_cloud_consent()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  update public.consent_records set withdrawn_at = now()
    where parent_id = auth.uid() and purpose = 'cloud_artwork_sync' and withdrawn_at is null;
end;
$$;

revoke all on function public.withdraw_cloud_consent() from public, anon;
grant execute on function public.withdraw_cloud_consent() to authenticated;

-- ---------------------------------------------------------------------------
-- Artwork (garden pictures only; immutable once saved; tombstoned on delete)
-- ---------------------------------------------------------------------------
create table public.artworks (
  id text primary key check (id ~ '^art_[0-9a-f-]{32,36}$'),
  parent_id uuid not null references auth.users (id) on delete cascade,
  template_id text not null check (template_id ~ '^[a-z0-9-]{1,40}$'),
  template_version integer not null check (template_version between 1 and 1000),
  fills jsonb not null check (jsonb_typeof(fills) = 'object' and pg_column_size(fills) < 8192),
  file_path text not null,
  created_at timestamptz not null,
  uploaded_at timestamptz not null default now(),
  check (file_path = parent_id::text || '/' || id || '.svg')
);

create index artworks_parent_idx on public.artworks (parent_id);

create table public.artwork_deletions (
  artwork_id text primary key,
  parent_id uuid not null references auth.users (id) on delete cascade,
  deleted_at timestamptz not null default now()
);

create index artwork_deletions_parent_idx on public.artwork_deletions (parent_id);

alter table public.artworks enable row level security;
alter table public.artwork_deletions enable row level security;
revoke all on public.artworks from anon, authenticated;
revoke all on public.artwork_deletions from anon, authenticated;
grant select, insert, delete on public.artworks to authenticated;
grant select on public.artwork_deletions to authenticated;

create policy artworks_select_own on public.artworks
  for select to authenticated using ((select auth.uid()) = parent_id);

create policy artworks_insert_own_with_consent on public.artworks
  for insert to authenticated
  with check (
    (select auth.uid()) = parent_id
    and (select public.has_cloud_consent())
    and not exists (select 1 from public.artwork_deletions d where d.artwork_id = artworks.id)
  );

create policy artworks_delete_own on public.artworks
  for delete to authenticated using ((select auth.uid()) = parent_id);

create policy artwork_deletions_select_own on public.artwork_deletions
  for select to authenticated using ((select auth.uid()) = parent_id);

-- A deleted picture leaves a small tombstone so a late upload from another device cannot bring it
-- back. Skipped when the whole account is being deleted.
create function private.tombstone_artwork()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from auth.users u where u.id = old.parent_id) then
    insert into public.artwork_deletions (artwork_id, parent_id)
      values (old.id, old.parent_id)
      on conflict (artwork_id) do nothing;
  end if;
  return old;
end;
$$;

create trigger artworks_tombstone
  before delete on public.artworks
  for each row execute function private.tombstone_artwork();

-- ---------------------------------------------------------------------------
-- Billing (Paddle). Written only by the verified billing server with the service role.
-- ---------------------------------------------------------------------------
create table public.billing_customers (
  parent_id uuid primary key references auth.users (id) on delete cascade,
  paddle_customer_id text not null unique check (paddle_customer_id ~ '^ctm_[a-z0-9]+$'),
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  paddle_subscription_id text primary key check (paddle_subscription_id ~ '^sub_[a-z0-9]+$'),
  paddle_customer_id text not null references public.billing_customers (paddle_customer_id) on delete cascade,
  status text not null check (status in ('active', 'trialing', 'past_due', 'paused', 'canceled')),
  price_id text not null check (price_id ~ '^pri_[a-z0-9]+$'),
  paid_through timestamptz,
  scheduled_change text check (scheduled_change in ('cancel', 'pause', 'resume')),
  last_event_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index subscriptions_customer_idx on public.subscriptions (paddle_customer_id);

create table public.transactions (
  paddle_transaction_id text primary key check (paddle_transaction_id ~ '^txn_[a-z0-9]+$'),
  paddle_customer_id text not null references public.billing_customers (paddle_customer_id) on delete cascade,
  price_id text not null check (price_id ~ '^pri_[a-z0-9]+$'),
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null check (status in ('draft', 'ready', 'billed', 'paid', 'completed', 'canceled', 'past_due')),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index transactions_customer_idx on public.transactions (paddle_customer_id);

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references auth.users (id) on delete cascade,
  scope text not null check (scope in ('pack', 'membership')),
  pack_id text check (pack_id ~ '^[a-z0-9-]{1,40}$'),
  source_type text not null check (source_type in ('transaction', 'subscription')),
  source_id text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check ((scope = 'pack') = (pack_id is not null)),
  check (ends_at is null or ends_at > starts_at),
  unique nulls not distinct (source_type, source_id, scope, pack_id)
);

create index entitlements_parent_idx on public.entitlements (parent_id);

create table public.webhook_events (
  event_id text primary key check (length(event_id) between 1 and 100),
  event_type text not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text
);

alter table public.billing_customers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.transactions enable row level security;
alter table public.entitlements enable row level security;
alter table public.webhook_events enable row level security;

revoke all on public.billing_customers, public.subscriptions, public.transactions,
  public.entitlements, public.webhook_events from anon, authenticated;
grant select on public.billing_customers, public.subscriptions, public.transactions,
  public.entitlements to authenticated;

create policy billing_customers_select_own on public.billing_customers
  for select to authenticated using ((select auth.uid()) = parent_id);

create policy subscriptions_select_own on public.subscriptions
  for select to authenticated using (
    exists (select 1 from public.billing_customers b
            where b.paddle_customer_id = subscriptions.paddle_customer_id
              and b.parent_id = (select auth.uid()))
  );

create policy transactions_select_own on public.transactions
  for select to authenticated using (
    exists (select 1 from public.billing_customers b
            where b.paddle_customer_id = transactions.paddle_customer_id
              and b.parent_id = (select auth.uid()))
  );

create policy entitlements_select_own on public.entitlements
  for select to authenticated using ((select auth.uid()) = parent_id);

-- webhook_events: no policies at all. Only the service role can read or write it.

-- ---------------------------------------------------------------------------
-- Private artwork storage: <parent id>/<artwork id>.svg, server-rendered SVG only.
-- No update policy, so a saved picture file can never be overwritten.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('artwork', 'artwork', false, 65536, array['image/svg+xml'])
on conflict (id) do update
  set public = false, file_size_limit = 65536, allowed_mime_types = array['image/svg+xml'];

create policy artwork_files_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'artwork' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy artwork_files_insert_own_with_consent on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'artwork'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and name ~ '^[0-9a-f-]{36}/art_[0-9a-f-]{32,36}\.svg$'
    and (select public.has_cloud_consent())
  );

create policy artwork_files_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'artwork' and (storage.foldername(name))[1] = (select auth.uid())::text);
