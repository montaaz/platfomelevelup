-- Migration 017 — Leads entrants : mémoire de conversation, intention, score, suivi
-- L'assistant qualifie chaque message (intention, score chaud/tiède/froid),
-- décide d'une passation à l'équipe (handoff) et retrouve les échanges
-- précédents du même contact pour répondre en contexte. L'équipe suit chaque
-- contact (statut) depuis Admin → Leads.

BEGIN;

ALTER TABLE inbound_leads
  ADD COLUMN IF NOT EXISTS intent      VARCHAR(24),               -- PRIX, COMMANDE, INFO_SERVICE, RENDEZ_VOUS, SUPPORT_CLIENT, RECLAMATION, PARTENARIAT, SPAM, AUTRE
  ADD COLUMN IF NOT EXISTS score       SMALLINT NOT NULL DEFAULT 0, -- 0-100
  ADD COLUMN IF NOT EXISTS handoff     BOOLEAN NOT NULL DEFAULT FALSE, -- l'équipe doit reprendre la main
  ADD COLUMN IF NOT EXISTS status      VARCHAR(12) NOT NULL DEFAULT 'NOUVEAU'
                                       CHECK (status IN ('NOUVEAU','EN_COURS','CONVERTI','PERDU')),
  ADD COLUMN IF NOT EXISTS pack_code   VARCHAR(40),               -- offre évoquée, si reconnue
  ADD COLUMN IF NOT EXISTS summary     VARCHAR(200);              -- résumé d'une ligne pour l'équipe

CREATE INDEX IF NOT EXISTS idx_inbound_leads_contact_time ON inbound_leads (channel, external_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbound_leads_handoff ON inbound_leads (handoff) WHERE handoff;

COMMIT;
