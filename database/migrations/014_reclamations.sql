-- Migration 014 — Réclamations clients
-- Le client dépose une réclamation depuis son espace (menu « Réclamations ») ;
-- l'équipe la traite depuis l'administration : statut, réponse écrite.
-- Processus publié sur levelupia.agency/fr/reclamations (exigé par la banque
-- pour le paiement en ligne) : accusé sous 2 j ouvrés, réponse sous 7 j ouvrés.

BEGIN;

-- Acceptation des conditions générales (CGU/CGV) à la création du compte :
-- la case est obligatoire, la date est conservée comme preuve.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS complaints (
  id                 BIGSERIAL PRIMARY KEY,
  client_id          BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  project_id         BIGINT REFERENCES projects(id) ON DELETE SET NULL,
  -- PAIEMENT, PRESTATION, DELAI, FACTURE, AUTRE
  category           VARCHAR(20) NOT NULL DEFAULT 'AUTRE',
  subject            VARCHAR(200) NOT NULL,
  message            TEXT NOT NULL,
  -- NOUVELLE → EN_COURS → RESOLUE | CLOTUREE
  status             VARCHAR(12) NOT NULL DEFAULT 'NOUVELLE'
                     CHECK (status IN ('NOUVELLE', 'EN_COURS', 'RESOLUE', 'CLOTUREE')),
  admin_reply        TEXT,
  handled_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  replied_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_complaints_client ON complaints (client_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints (status);

CREATE TRIGGER trg_complaints_updated BEFORE UPDATE ON complaints
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
