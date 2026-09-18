-- Migration 005 — Packs du site vitrine, commande et contrôle du paiement
-- Parcours : site vitrine → « Ajouter au panier » → inscription → paiement →
-- accès à la plateforme, où le pack apparaît comme projet/abonnement.

BEGIN;

-- ---------------------------------------------------------------- catalogue
-- Les packs et formules du site vitrine, pour que le prix ne soit jamais
-- décidé par le navigateur : il est relu ici au moment de la commande.
CREATE TABLE IF NOT EXISTS packs (
  id            BIGSERIAL PRIMARY KEY,
  code          VARCHAR(40) NOT NULL UNIQUE,   -- PACK_DECOUVERTE, ABO_STARTER, ...
  name          VARCHAR(120) NOT NULL,
  description   TEXT,
  price         NUMERIC(12,3) NOT NULL CHECK (price >= 0),
  currency      CHAR(3) NOT NULL DEFAULT 'TND',
  is_monthly    BOOLEAN NOT NULL DEFAULT FALSE, -- abonnement mensuel ?
  service_id    BIGINT REFERENCES services(id) ON DELETE SET NULL,
  position      SMALLINT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------ commande
CREATE TYPE order_status AS ENUM (
  'EN_ATTENTE_PAIEMENT',  -- inscrit, paiement non confirmé → accès bloqué
  'PAYEE',                -- paiement confirmé → accès ouvert
  'ANNULEE'
);

CREATE TABLE IF NOT EXISTS orders (
  id                BIGSERIAL PRIMARY KEY,
  client_id         BIGINT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  pack_id           BIGINT NOT NULL REFERENCES packs(id) ON DELETE RESTRICT,
  status            order_status NOT NULL DEFAULT 'EN_ATTENTE_PAIEMENT',
  amount            NUMERIC(12,3) NOT NULL CHECK (amount >= 0),
  currency          CHAR(3) NOT NULL DEFAULT 'TND',
  -- traçabilité du paiement
  payment_method    payment_method,             -- renseigné à la confirmation
  payment_reference VARCHAR(160),
  paid_at           TIMESTAMPTZ,
  confirmed_by      BIGINT REFERENCES users(id) ON DELETE SET NULL,
  -- ce que la commande a produit une fois payée
  project_id        BIGINT REFERENCES projects(id) ON DELETE SET NULL,
  subscription_id   BIGINT REFERENCES subscriptions(id) ON DELETE SET NULL,
  invoice_id        BIGINT REFERENCES invoices(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_client ON orders (client_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);

CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------- contrôle d'accès client
-- Un client n'entre dans la plateforme que si son accès est ouvert.
-- Les clients existants (créés avant cette migration) gardent leur accès.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS access_granted BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS access_granted_at TIMESTAMPTZ;

COMMIT;
