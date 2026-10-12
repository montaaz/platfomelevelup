-- Migration 019 — Paiement par carte pour les clients hors Tunisie (Monetico, Crédit Mutuel)
-- Le prix reste en dinars ; la carte est débitée en euros. On garde le montant
-- et la devise réellement passés à la banque, pour la comptabilité.

BEGIN;
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS gateway_amount   NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS gateway_currency CHAR(3);
ALTER TABLE prepaid_payments
  ADD COLUMN IF NOT EXISTS gateway_amount   NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS gateway_currency CHAR(3);
COMMIT;
