-- Migration 004 — Questionnaire d'accueil client (onboarding)
-- Renseigné par le client juste après sa première connexion, puis consultable
-- par l'admin depuis la fiche client.

BEGIN;

-- Coordonnées complétées par le client
ALTER TABLE clients ADD COLUMN IF NOT EXISTS phone_country_code VARCHAR(8);

-- Réponses du questionnaire
ALTER TABLE clients ADD COLUMN IF NOT EXISTS industry            VARCHAR(60);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS industry_other      VARCHAR(160);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_role        VARCHAR(60);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_role_other  VARCHAR(160);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS company_size        VARCHAR(40);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS main_market         VARCHAR(80);   -- pays principal
ALTER TABLE clients ADD COLUMN IF NOT EXISTS main_need           VARCHAR(60);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS heard_from          VARCHAR(60);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS heard_from_other    VARCHAR(160);

-- Suivi de complétion : l'application sait s'il faut afficher le questionnaire
ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Retrouver rapidement les clients qui n'ont pas encore répondu
CREATE INDEX IF NOT EXISTS idx_clients_onboarding
  ON clients (onboarding_completed_at)
  WHERE onboarding_completed_at IS NULL AND deleted_at IS NULL;

COMMIT;
