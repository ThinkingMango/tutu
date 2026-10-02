-- Draft of cloud saving notice v2. Only "Your choices" changes: v1 promised a data download in the
-- grown-ups area that the app does not offer, so v2 says how to get a copy by email instead, and
-- mentions the permission record PDF. Stays hidden until approved in a separate migration.
-- v1 is not retired: permissions given under v1 stay valid (has_cloud_consent checks retired_at).
with notice(body) as (
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
Cloud saving is optional, and Little Mandala works fully without it. In the grown-ups area you can turn it off at any time, delete your account, and download a PDF record of this permission. To get a copy of your data, email support@smartmango.ai from the address you sign in with. We will send it to you within one month.

## How you give permission
Only a parent or legal guardian may turn this on. To protect your child, you must have signed in with a fresh email link in the last 10 minutes. We record the date, the version of this notice, and that you confirmed with a recent sign-in.$notice$)
)
insert into public.consent_notices (version, purpose, title, body, body_sha256)
select 2, 'cloud_artwork_sync', 'Cloud saving for your child''s pictures', body,
       encode(sha256(convert_to(body, 'UTF8')), 'hex')
from notice
on conflict (version) do nothing;
