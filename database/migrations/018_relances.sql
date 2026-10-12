-- Migration 018 — Relances automatiques des prospects chauds
-- Un prospect chaud resté sans suite 48 h reçoit UNE relance (WhatsApp ou
-- e-mail) ; la date est gardée ici pour ne jamais relancer deux fois.

BEGIN;
ALTER TABLE inbound_leads ADD COLUMN IF NOT EXISTS followed_up_at TIMESTAMPTZ;
ALTER TABLE inbound_leads ADD COLUMN IF NOT EXISTS media_kind VARCHAR(10); -- audio, image : message reçu en vocal / en photo
COMMIT;
