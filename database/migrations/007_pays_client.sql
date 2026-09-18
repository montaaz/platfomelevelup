-- Migration 007 — Pays du client : détecté puis confirmé
--
-- Deux informations distinctes, volontairement séparées :
--   · country          — ce que le client a saisi (fait foi, mais souvent vide)
--   · detected_country  — ce que le réseau indique (Cloudflare, jamais saisi)
--
-- La colonne `country` porte un DEFAULT 'Tunisie' hérité du schéma initial :
-- tout client créé sans adresse paraît donc tunisien. On ne peut pas s'y fier
-- pour la répartition géographique, d'où la colonne dédiée.

BEGIN;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS detected_country_code CHAR(2),
  ADD COLUMN IF NOT EXISTS detected_country      VARCHAR(80),
  ADD COLUMN IF NOT EXISTS detected_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS detected_source       VARCHAR(20);

COMMENT ON COLUMN clients.detected_country_code IS 'ISO 3166-1 alpha-2 issu du réseau (en-tête CF-IPCountry).';
COMMENT ON COLUMN clients.detected_country      IS 'Nom français du pays détecté, figé à la détection.';
COMMENT ON COLUMN clients.detected_source       IS 'Origine de la détection : cloudflare, manuel.';

-- Le pays saisi n'est plus présumé tunisien : une adresse vide doit rester
-- vide pour que la détection ait un sens.
ALTER TABLE clients ALTER COLUMN country DROP DEFAULT;

-- Les tableaux de bord filtrent et regroupent par pays effectif.
CREATE INDEX IF NOT EXISTS idx_clients_detected_country ON clients (detected_country_code)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_clients_country ON clients (country)
  WHERE deleted_at IS NULL;

-- Alerte « complétez votre profil » adressée au client.
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'PROFIL_INCOMPLET';

COMMIT;
