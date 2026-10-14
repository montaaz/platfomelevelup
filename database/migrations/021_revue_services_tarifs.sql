-- Revue des services et tarifs (13 octobre 2026) : nouvelles offres commandables
-- depuis le site vitrine, et périmètre du Pack Découverte limité au site web
-- (5 à 6 pages) et au site marchand sur devis.
UPDATE packs SET
  description = 'Site vitrine IA (5 à 6 pages) ou site marchand IA (devis sur demande)',
  includes = ARRAY['Site web (5 à 6 pages)', 'Site marchand sur devis']
WHERE code = 'PACK_DECOUVERTE';

INSERT INTO packs (code, name, description, price, currency, is_monthly, service_id, position, is_active, includes, tagline) VALUES
  ('AVATAR_VOIX',       'Avatar et porte-parole virtuel et doublage multi-langues', 'Voix off, doublage multilingue et porte-parole virtuel réunis dans une offre.', 99,  'TND', false, 1, 8,  true, ARRAY['Voix off', 'Doublage multilingue', 'Porte-parole virtuel'], 'Voix off, doublage multilingue et porte-parole virtuel réunis dans une offre.'),
  ('IDENTITE_EXPRESS',  'Identité visuelle express',  'Logo et charte graphique générés rapidement pour améliorer votre image.', 149, 'TND', false, 3, 9,  true, ARRAY['Logo', 'Charte graphique'], 'Logo et charte graphique générés rapidement.'),
  ('AUTOMATISATION_N1', 'Automatisation — Niveau 1 : suivi, qualification et attribution', 'Classer les demandes par besoin et urgence, les attribuer au bon responsable et créer une tâche de suivi. Après un devis, programmer une relance et l''arrêter une fois le dossier marqué répondu ou accepté.', 250, 'TND', false, 3, 10, true, ARRAY['Classement des demandes par besoin et urgence', 'Attribution au bon responsable et tâche de suivi', 'Relance programmée après devis'], 'Une offre complète pour les prospects.'),
  ('SEO_STARTER',       'SEO Starter',  'Pour les petites entreprises : audit initial, suivi de 10 mots-clés, recommandations SEO, rapport mensuel.', 99,  'TND', false, 2, 11, true, ARRAY['Audit initial', 'Suivi de 10 mots-clés', 'Recommandations SEO', 'Rapport mensuel'], 'Petites entreprises'),
  ('SEO_BUSINESS',      'SEO Business', 'Pour les PME : suivi de 30 mots-clés, optimisation de 5 pages par mois, analyse concurrentielle, rapport détaillé.', 290, 'TND', false, 2, 12, true, ARRAY['Suivi de 30 mots-clés', 'Optimisation de 5 pages / mois', 'Analyse concurrentielle', 'Rapport détaillé'], 'PME')
ON CONFLICT (code) DO NOTHING;
