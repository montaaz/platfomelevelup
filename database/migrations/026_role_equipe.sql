-- Accès de l'équipe (notes de Sarra, §03) : projets, échéances et clients,
-- sans aucune donnée financière.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'EQUIPE';
