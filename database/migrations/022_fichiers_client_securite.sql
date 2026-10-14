-- Fichiers déposés par les clients (logo, photos, PDF, documents) pour décrire
-- leurs besoins, et journal des événements de sécurité (fichiers refusés,
-- suspects, antivirus). Les fichiers eux-mêmes sont sur le disque, hors web.
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'ALERTE_SECURITE';

CREATE TABLE IF NOT EXISTS client_files (
  id                  BIGSERIAL PRIMARY KEY,
  client_id           BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  uploaded_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  need                VARCHAR(40),
  original_name       VARCHAR(255) NOT NULL,
  storage_key         VARCHAR(255) NOT NULL UNIQUE,
  mime_type           VARCHAR(120) NOT NULL,
  kind                VARCHAR(12) NOT NULL,
  size_bytes          BIGINT NOT NULL,
  sha256              CHAR(64) NOT NULL,
  scanned_with        VARCHAR(60),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_files_client ON client_files (client_id, created_at DESC);

CREATE TABLE IF NOT EXISTS security_events (
  id         BIGSERIAL PRIMARY KEY,
  client_id  BIGINT REFERENCES clients(id) ON DELETE SET NULL,
  user_id    BIGINT REFERENCES users(id) ON DELETE SET NULL,
  kind       VARCHAR(40) NOT NULL,
  severity   VARCHAR(10) NOT NULL,
  reason     TEXT NOT NULL,
  file_name  VARCHAR(255),
  sha256     CHAR(64),
  ip         VARCHAR(64),
  user_agent VARCHAR(300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_client ON security_events (client_id, created_at DESC);
