-- Founder approved consent notice v1 in the v0 chat on 2026-09-27.
-- The guard only approves the exact reviewed text (SHA-256 prefix 5bd6b14af4d6).
update public.consent_notices
set approved_at = '2026-09-27 08:23:45.505765+00', approved_by = 'Founder (approved in v0 chat)'
where version = 1 and approved_at is null and body_sha256 like '5bd6b14af4d6%';
