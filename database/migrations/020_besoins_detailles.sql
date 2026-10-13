-- Migration 020 — Besoins détaillés du questionnaire d'accueil
-- Pour chaque besoin coché (site vitrine, site marchand, shooting, vidéos,
-- identité visuelle…), le client décrit son projet : description, pages
-- souhaitées, palette de couleurs, style, mood… Conservé tel quel (JSON) :
-- le client le relit comme « paramétrage » de son projet, l'équipe le voit
-- sur la fiche client et sur chaque projet.

BEGIN;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS needs_details JSONB NOT NULL DEFAULT '{}'::jsonb;
COMMIT;
