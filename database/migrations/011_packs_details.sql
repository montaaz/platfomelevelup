-- Migration 011 — Détail des offres
--
-- Les packs n'avaient qu'un résumé. Pour que l'assistant puisse détailler
-- une offre, conseiller selon un besoin et comparer deux packs, chaque
-- offre reçoit la liste de ce qu'elle comprend et sa phrase d'accroche —
-- les mêmes textes que le site vitrine affiche.

BEGIN;

ALTER TABLE packs
  ADD COLUMN IF NOT EXISTS includes TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tagline  TEXT;

COMMENT ON COLUMN packs.includes IS 'Ce que l''offre comprend, une ligne par élément.';
COMMENT ON COLUMN packs.tagline  IS 'Phrase d''accroche : à qui l''offre s''adresse.';

UPDATE packs SET
  includes = ARRAY['Site vitrine IA (5-6 pages)', 'ou shooting produit IA (10 visuels)', 'La première étape idéale pour une nouvelle marque'],
  tagline  = 'La façon la plus simple de commencer. Choisissez ce dont votre entreprise a le plus besoin maintenant, et faisons-le bien.'
WHERE code = 'PACK_DECOUVERTE';

UPDATE packs SET
  includes = ARRAY['Site vitrine IA', 'Shooting produit IA (10 visuels)', '4 vidéos'],
  tagline  = 'Pour lancer une marque avec un site, des visuels et des vidéos prêts à publier.'
WHERE code = 'PACK_LANCEMENT';

UPDATE packs SET
  includes = ARRAY['Site vitrine IA', 'Shooting produit IA (20 visuels)', '6 vidéos'],
  tagline  = 'Conçu pour les marques qui vendent déjà. Plus de visuels, plus de vidéo, et de quoi rester visible chaque semaine.'
WHERE code = 'PACK_CROISSANCE';

UPDATE packs SET
  includes = ARRAY['Site vitrine IA', 'Shooting produit IA (40 visuels)', '8 vidéos'],
  tagline  = 'Le volume d''une équipe de production, pour les marques qui publient tous les jours.'
WHERE code = 'PACK_PRO_MAX';

UPDATE packs SET includes = ARRAY['12 visuels par mois', '4 vidéos par mois'],
  tagline = 'Un flux régulier de contenus pour vos réseaux, sans équipe interne.' WHERE code = 'ABO_STARTER';
UPDATE packs SET includes = ARRAY['20 visuels par mois', '6 vidéos par mois'],
  tagline = 'Le rythme d''une marque active : davantage de visuels et de vidéos chaque mois.' WHERE code = 'ABO_PRO';
UPDATE packs SET includes = ARRAY['Gestion de feed Instagram', 'Gestion de feed Facebook', 'Gestion de feed LinkedIn'],
  tagline = 'Nous publions pour vous, chaque semaine, sur vos réseaux.' WHERE code = 'ABO_SOCIAL';

COMMIT;
