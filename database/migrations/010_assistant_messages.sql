-- Migration 010 — Historique des échanges avec l'assistant
--
-- Chaque question posée au Dashboard Buddy et chaque réponse sont
-- conservées, rattachées au compte qui les a émises et, pour un client, à
-- sa fiche : le client retrouve sa conversation en rouvrant le widget,
-- l'équipe voit sur la fiche client ce qui lui a été demandé.
--
-- La suppression d'un compte ou d'un client emporte son historique.

BEGIN;

CREATE TABLE IF NOT EXISTS assistant_messages (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT      NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  client_id   BIGINT               REFERENCES clients(id) ON DELETE CASCADE,
  role        VARCHAR(10) NOT NULL CHECK (role IN ('USER', 'ASSISTANT')),
  body        TEXT        NOT NULL,
  kind        VARCHAR(10),          -- answer | refusal | review (réponses seulement)
  intent      VARCHAR(40),          -- intention retenue (réponses seulement)
  context     JSONB,                -- contexte renvoyé, pour reprendre un fil après rechargement
  actions     JSONB,                -- boutons affichés avec la réponse
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE assistant_messages IS 'Échanges avec le Dashboard Buddy, par compte.';

-- Lecture d'un fil : par compte, du plus récent au plus ancien.
CREATE INDEX IF NOT EXISTS idx_assistant_messages_user
  ON assistant_messages (user_id, created_at DESC);
-- Fiche client : tous les comptes d'un même client.
CREATE INDEX IF NOT EXISTS idx_assistant_messages_client
  ON assistant_messages (client_id, created_at DESC) WHERE client_id IS NOT NULL;

COMMIT;
