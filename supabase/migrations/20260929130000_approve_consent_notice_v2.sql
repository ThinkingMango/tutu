-- Founder approved consent notice v2 in the v0 chat on 2026-09-29.
-- The guard only approves the exact reviewed text (SHA-256 prefix f1198a716706).
-- Version 1 is deliberately left in force: v2 only corrects how parents get a copy of their data,
-- so existing permissions stay valid and those parents are not asked to agree again.
update public.consent_notices
set approved_at = now(), approved_by = 'Founder (approved in v0 chat)'
where version = 2 and approved_at is null and body_sha256 like 'f1198a716706%';
