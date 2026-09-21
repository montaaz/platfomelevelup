-- Migration 008 — Plusieurs secteurs d'activité par client
--
-- Une entreprise relève souvent de plusieurs métiers : un hôtel fait aussi de
-- la restauration et de l'événementiel. Le questionnaire n'en acceptait qu'un.
--
-- La colonne `industry` est conservée telle quelle : elle porte le secteur
-- principal (le premier coché) et reste lisible par tout ce qui l'utilise
-- déjà. La nouvelle colonne porte la liste complète.

BEGIN;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS industries TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN clients.industries IS
  'Secteurs d''activité cochés, dans l''ordre de la liste. `industry` reprend le premier.';

-- Les fiches déjà renseignées reprennent leur secteur unique, pour que
-- l'affichage soit homogène sans distinguer avant/après.
UPDATE clients
   SET industries = ARRAY[industry]
 WHERE industry IS NOT NULL
   AND btrim(industry) <> ''
   AND cardinality(industries) = 0;

-- Recherche par secteur : un index GIN traite l'opérateur « contient ».
CREATE INDEX IF NOT EXISTS idx_clients_industries ON clients USING GIN (industries);

COMMIT;
