-- Migration 002 — 24 août 2026
-- Feedback: keep a single serial identifier per table. public_id (UUID) is
-- removed everywhere EXCEPT files, where the cahier des charges (§7) requires
-- non-guessable download links.

BEGIN;

ALTER TABLE clients          DROP COLUMN IF EXISTS public_id;
ALTER TABLE users            DROP COLUMN IF EXISTS public_id;
ALTER TABLE team_members     DROP COLUMN IF EXISTS public_id;
ALTER TABLE projects         DROP COLUMN IF EXISTS public_id;
ALTER TABLE messages         DROP COLUMN IF EXISTS public_id;
ALTER TABLE invoices         DROP COLUMN IF EXISTS public_id;
ALTER TABLE subscriptions    DROP COLUMN IF EXISTS public_id;
ALTER TABLE project_requests DROP COLUMN IF EXISTS public_id;

-- files.public_id stays: it is the non-guessable download token.

COMMIT;
