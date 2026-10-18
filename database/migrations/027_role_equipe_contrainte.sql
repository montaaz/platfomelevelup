-- Espace équipe (notes de Sarra, §03) : un compte EQUIPE n'est rattaché à
-- aucun client, comme un compte ADMIN. La contrainte d'origine n'admettait
-- que CLIENT ou ADMIN et refusait donc toute création de compte équipe.
BEGIN;
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_role_client;
ALTER TABLE users ADD CONSTRAINT chk_role_client CHECK (
  (role = 'CLIENT' AND client_id IS NOT NULL)
  OR (role IN ('ADMIN', 'EQUIPE') AND client_id IS NULL)
);
COMMIT;
