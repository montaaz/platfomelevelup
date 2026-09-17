-- Migration 003 — Connexion Google (OAuth)
-- Un compte Google n'a pas de mot de passe local : password_hash devient
-- optionnel. On mémorise le fournisseur et l'identifiant Google stable (sub)
-- pour rattacher le compte même si l'utilisateur change d'adresse chez Google.

BEGIN;

ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) NOT NULL DEFAULT 'LOCAL';
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub   VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url   TEXT;

-- un même compte Google ne peut être rattaché qu'à un seul utilisateur
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users (google_sub) WHERE google_sub IS NOT NULL;

-- garde-fou : un compte LOCAL doit avoir un mot de passe,
-- un compte GOOGLE doit avoir son identifiant Google.
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_auth_provider;
ALTER TABLE users ADD CONSTRAINT chk_auth_provider CHECK (
  (auth_provider = 'LOCAL'  AND password_hash IS NOT NULL) OR
  (auth_provider = 'GOOGLE' AND google_sub IS NOT NULL)
);

COMMIT;
