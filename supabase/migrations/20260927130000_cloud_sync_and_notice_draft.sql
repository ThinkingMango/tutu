-- Day 3b: per-parent artwork ids, one shared fresh-sign-in check, turning cloud saving off,
-- and notice v1 stored as an unapproved draft. Nothing can consent to a draft.

-- Artwork ids are made on the device, so they only need to be unique within one parent's account.
-- A picture kept on a shared tablet can then be saved by a different parent without a clash.
alter table public.artworks drop constraint artworks_pkey;
alter table public.artworks add primary key (parent_id, id);
drop index if exists public.artworks_parent_idx;

alter table public.artwork_deletions drop constraint artwork_deletions_pkey;
alter table public.artwork_deletions add primary key (parent_id, artwork_id);
drop index if exists public.artwork_deletions_parent_idx;

drop policy artworks_insert_own_with_consent on public.artworks;
create policy artworks_insert_own_with_consent on public.artworks
  for insert to authenticated
  with check (
    (select auth.uid()) = parent_id
    and (select public.has_cloud_consent())
    and not exists (
      select 1 from public.artwork_deletions d
      where d.parent_id = artworks.parent_id and d.artwork_id = artworks.id
    )
  );

-- Turning cloud saving off removes every copy at once; those removals must not block a later re-upload.
create or replace function private.tombstone_artwork()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('little_mandala.skip_tombstone', true), '') = 'on' then
    return old;
  end if;
  if exists (select 1 from auth.users u where u.id = old.parent_id) then
    insert into public.artwork_deletions (artwork_id, parent_id)
      values (old.id, old.parent_id)
      on conflict (parent_id, artwork_id) do nothing;
  end if;
  return old;
end;
$$;

-- Consent, turning cloud saving off, and account deletion all need an email-link sign-in in the last 10 minutes.
create function private.require_recent_sign_in()
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  v_claims jsonb := auth.jwt();
  v_signed_in_at timestamptz;
begin
  if auth.uid() is null or coalesce((v_claims ->> 'is_anonymous')::boolean, false) then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  select max(to_timestamp((entry ->> 'timestamp')::bigint))
    into v_signed_in_at
    from jsonb_array_elements(coalesce(v_claims -> 'amr', '[]'::jsonb)) as entry;
  if v_signed_in_at is null or v_signed_in_at < now() - interval '10 minutes' then
    raise exception 'recent_sign_in_required' using errcode = '42501';
  end if;
  return v_signed_in_at;
end;
$$;

create or replace function public.give_cloud_consent(p_notice_version integer)
returns public.consent_records
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_signed_in_at timestamptz := private.require_recent_sign_in();
  v_row public.consent_records;
begin
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
      'session:' || coalesce(auth.jwt() ->> 'session_id', 'unknown') || ';signed_in_at:' || v_signed_in_at::text
    )
    returning * into v_row;

  return v_row;
end;
$$;

-- Withdrawing consent without deleting the cloud copies would leave data nobody agreed to keep.
drop function public.withdraw_cloud_consent();

-- Withdraws consent and deletes every cloud artwork row. The browser then removes the files.
create function public.disable_cloud_saving()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_removed integer;
begin
  perform private.require_recent_sign_in();

  update public.consent_records set withdrawn_at = now()
    where parent_id = v_uid and purpose = 'cloud_artwork_sync' and withdrawn_at is null;

  perform set_config('little_mandala.skip_tombstone', 'on', true);
  delete from public.artworks where parent_id = v_uid;
  get diagnostics v_removed = row_count;
  perform set_config('little_mandala.skip_tombstone', 'off', true);

  delete from public.artwork_deletions where parent_id = v_uid;
  return v_removed;
end;
$$;

revoke all on function public.disable_cloud_saving() from public, anon;
grant execute on function public.disable_cloud_saving() to authenticated;

-- Notice v1, stored unapproved. The founder approves this exact text in a separate, recorded step.
with notice (body) as (
  values ($notice$## What cloud saving does
Little Mandala works without cloud saving. Pictures your child colors are kept on this device. If you turn cloud saving on, each picture your child puts in "My garden" is also copied to your parent account, so it is backed up and shows up on other devices where you sign in. Pictures already in the garden on this device are copied too.

## What we store
For each garden picture: which flower design was used, the colors chosen for each part, when it was made, and an image file of the finished picture. It is linked to your parent account, which holds your email address. Pictures that are still being colored stay on the device.

## What we never collect
We do not ask for or store your child's name, age, birthday, photo, voice, school, or location. Little Mandala has no ads, chat, public sharing, or advertising trackers.

## Who can see it
Only you, when you are signed in. Pictures are kept in private storage. Our database and storage provider, Supabase, keeps the data for us in the United States. We do not sell it, share it for advertising, or use it to build a profile of your child.

## How long we keep it
Until you remove it. Taking a picture out of "My garden" removes it from your account too. Turning off cloud saving deletes every cloud copy; pictures already on your devices stay there. Deleting your account deletes your cloud pictures and account records. We keep a short note that a picture was removed, with no picture content, so an old device cannot upload it again. That note is deleted with your account. Deleted data can stay in the provider's encrypted backups for a short time until those backups expire.

## Your choices
Cloud saving is optional, and Little Mandala works fully without it. You can turn it off at any time in the grown-ups area. There you can also download a copy of your data and delete your account.

## How you give permission
Only a parent or legal guardian may turn this on. To protect your child, you must have signed in with a fresh email link in the last 10 minutes. We record the date, the version of this notice, and that you confirmed with a recent sign-in.$notice$)
)
insert into public.consent_notices (version, purpose, title, body, body_sha256)
select 1, 'cloud_artwork_sync', 'Cloud saving for your child''s pictures', body,
       encode(sha256(convert_to(body, 'UTF8')), 'hex')
from notice
on conflict (version) do nothing;
