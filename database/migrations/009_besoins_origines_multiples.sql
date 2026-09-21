-- Migration 009 — Plusieurs besoins et plusieurs origines par client
--
-- Suite de la 008, même raisonnement : un client veut rarement une seule
-- chose (un site web ET des vidéos ET un logo), et il vous a souvent
-- découverts de plusieurs façons (bouche-à-oreille puis Instagram).
--
-- Les colonnes `main_need` et `heard_from` sont conservées et portent la
-- valeur principale — la première de la liste — pour que tout ce qui les
-- lit déjà continue de fonctionner.

BEGIN;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS main_needs  TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS heard_froms TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN clients.main_needs IS
  'Besoins cochés, dans l''ordre de la liste. `main_need` reprend le premier.';
COMMENT ON COLUMN clients.heard_froms IS
  'Origines cochées, dans l''ordre de la liste. `heard_from` reprend la première.';

-- Les fiches déjà renseignées reprennent leur valeur unique, pour que
-- l'affichage soit homogène sans distinguer avant/après.
UPDATE clients
   SET main_needs = ARRAY[main_need]
 WHERE main_need IS NOT NULL
   AND btrim(main_need) <> ''
   AND cardinality(main_needs) = 0;

UPDATE clients
   SET heard_froms = ARRAY[heard_from]
 WHERE heard_from IS NOT NULL
   AND btrim(heard_from) <> ''
   AND cardinality(heard_froms) = 0;

-- Recherche par besoin : un index GIN traite l'opérateur « contient ».
CREATE INDEX IF NOT EXISTS idx_clients_main_needs ON clients USING GIN (main_needs);

COMMIT;
