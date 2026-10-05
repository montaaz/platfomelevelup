-- Migration 012 — Paiement en ligne ClicToPay (Attijari E-Payment)
-- Chaque tentative de paiement ouvre une transaction chez la banque ; on garde
-- son identifiant pour retrouver la commande au retour du client et lors de la
-- notification de la banque.

BEGIN;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS gateway_order_id VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_gateway_order ON orders (gateway_order_id);

COMMIT;
