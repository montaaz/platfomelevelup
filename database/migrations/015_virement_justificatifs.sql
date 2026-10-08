-- Migration 015 — Paiement par virement bancaire
-- Le client règle sur le RIB de l'agence puis dépose son justificatif de
-- virement ; l'équipe le vérifie et valide (la commande devient PAYEE, comme
-- pour la carte) ou le refuse avec un motif (le client peut en déposer un autre).

BEGIN;

CREATE TABLE IF NOT EXISTS payment_proofs (
  id                 BIGSERIAL PRIMARY KEY,
  order_id           BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  client_id          BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  uploaded_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  original_name      VARCHAR(255) NOT NULL,
  storage_key        TEXT NOT NULL UNIQUE,
  mime_type          VARCHAR(120) NOT NULL,
  size_bytes         BIGINT NOT NULL,
  -- référence / date du virement indiquées par le client
  reference          VARCHAR(160),
  -- EN_ATTENTE → ACCEPTE | REFUSE
  status             VARCHAR(12) NOT NULL DEFAULT 'EN_ATTENTE'
                     CHECK (status IN ('EN_ATTENTE', 'ACCEPTE', 'REFUSE')),
  review_note        TEXT,
  reviewed_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_proofs_order ON payment_proofs (order_id);
CREATE INDEX IF NOT EXISTS idx_payment_proofs_status ON payment_proofs (status);

COMMIT;
