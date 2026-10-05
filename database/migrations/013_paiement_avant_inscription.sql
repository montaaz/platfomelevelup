-- Migration 013 — Paiement depuis le panier du site vitrine, avant inscription
-- Le visiteur paie d'abord chez la banque, puis crée son compte : le paiement
-- est gardé ici le temps d'être rattaché à un client, où il devient une
-- commande payée (orders).

BEGIN;

CREATE TABLE IF NOT EXISTS prepaid_payments (
  id                BIGSERIAL PRIMARY KEY,
  pack_id           BIGINT NOT NULL REFERENCES packs(id) ON DELETE RESTRICT,
  amount            NUMERIC(12,3) NOT NULL CHECK (amount >= 0),
  currency          CHAR(3) NOT NULL DEFAULT 'TND',
  -- EN_ATTENTE : transaction ouverte chez la banque
  -- PAYEE      : carte débitée, pas encore de compte client
  -- RATTACHEE  : devenue la commande order_id
  status            VARCHAR(12) NOT NULL DEFAULT 'EN_ATTENTE'
                    CHECK (status IN ('EN_ATTENTE', 'PAYEE', 'RATTACHEE')),
  gateway_order_id  VARCHAR(64) UNIQUE,
  payment_reference VARCHAR(160),
  paid_at           TIMESTAMPTZ,
  order_id          BIGINT REFERENCES orders(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prepaid_status ON prepaid_payments (status);

COMMIT;
