-- ============================================================================
-- LEVEL UP IA — Dashboard : PostgreSQL schema
-- Source of truth: "Cahier des charges" 23 août 2026 + architecture 19 août
-- Design rules:
--   * Internal PK  : BIGSERIAL (SERIAL, 64-bit version so it never overflows
--     — auto-incrementing integer id, scalable)
--   * files.public_id (UUID) is the ONLY non-serial identifier kept: the spec
--     requires non-guessable download links. Every other table uses id alone.
--   * Two login roles only: ADMIN and CLIENT. Team members are managed rows
--     (table team_members) WITHOUT login accounts (cahier des charges ch. 2/8).
--   * All money in NUMERIC(12,3) — Tunisian dinar has 3 decimals (millimes).
--   * created_at / updated_at everywhere, soft-delete (deleted_at) on
--     business entities so history is never lost (invoices reference clients).
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS citext;      -- case-insensitive emails

-- ----------------------------------------------------------------------------
-- ENUMS (French labels = the exact statuses of the cahier des charges)
-- ----------------------------------------------------------------------------
CREATE TYPE user_role           AS ENUM ('ADMIN', 'CLIENT');
CREATE TYPE project_status      AS ENUM ('EN_ATTENTE', 'EN_COURS', 'EN_REVISION', 'LIVRE', 'CLOTURE');
CREATE TYPE file_kind           AS ENUM ('LIVRABLE', 'ELEMENT_CLIENT');           -- sens du fichier
CREATE TYPE file_approval       AS ENUM ('EN_ATTENTE', 'APPROUVE', 'REVISION_DEMANDEE');
CREATE TYPE invoice_status      AS ENUM ('BROUILLON', 'EN_ATTENTE', 'PAYEE', 'EN_RETARD', 'ANNULEE');
CREATE TYPE payment_method      AS ENUM ('VIREMENT', 'CARTE', 'ESPECES', 'CHEQUE', 'EN_LIGNE');
CREATE TYPE subscription_status AS ENUM ('ACTIF', 'EN_PAUSE', 'ANNULE', 'EXPIRE');
CREATE TYPE request_status      AS ENUM ('NOUVELLE', 'EN_ETUDE', 'ACCEPTEE', 'REFUSEE');
CREATE TYPE notification_type   AS ENUM (
  'STATUT_PROJET',        -- changement de statut
  'NOUVEAU_LIVRABLE',     -- nouveau fichier déposé
  'NOUVELLE_FACTURE',     -- facture émise
  'NOUVEAU_MESSAGE',      -- message reçu
  'ABONNEMENT_ECHEANCE',  -- abonnement qui arrive à échéance
  'DEMANDE_PROJET'        -- demande de nouveau projet / devis
);

-- ----------------------------------------------------------------------------
-- updated_at trigger (shared)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 1. clients — the companies the agency works for
-- ----------------------------------------------------------------------------
CREATE TABLE clients (
  id               BIGSERIAL PRIMARY KEY,
  company_name     VARCHAR(160) NOT NULL,
  contact_name     VARCHAR(160) NOT NULL,
  email            CITEXT,
  phone            VARCHAR(40),
  address          TEXT,
  city             VARCHAR(80),
  country          VARCHAR(80) DEFAULT 'Tunisie',
  tax_id           VARCHAR(60),                 -- matricule fiscal, printed on invoices
  billing_address  TEXT,                        -- falls back to address when NULL
  notes            TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at       TIMESTAMPTZ,                 -- soft delete: history stays intact
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clients_active ON clients (is_active) WHERE deleted_at IS NULL;
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. users — the login accounts. ADMIN (agency) or CLIENT (attached to a client)
-- ----------------------------------------------------------------------------
CREATE TABLE users (
  id                    BIGSERIAL PRIMARY KEY,
  role                  user_role NOT NULL,
  client_id             BIGINT REFERENCES clients(id) ON DELETE RESTRICT,
  full_name             VARCHAR(160) NOT NULL,
  email                 CITEXT NOT NULL UNIQUE,
  password_hash         TEXT NOT NULL,               -- argon2id
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at         TIMESTAMPTZ,
  failed_login_attempts SMALLINT NOT NULL DEFAULT 0, -- brute-force lockout
  locked_until          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- a CLIENT account must belong to a client; an ADMIN never does
  CONSTRAINT chk_role_client CHECK (
    (role = 'CLIENT' AND client_id IS NOT NULL) OR
    (role = 'ADMIN'  AND client_id IS NULL)
  )
);
CREATE INDEX idx_users_client ON users (client_id) WHERE client_id IS NOT NULL;
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE password_reset_tokens (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,                        -- store the hash, never the token
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_prt_user ON password_reset_tokens (user_id);

-- ----------------------------------------------------------------------------
-- 3. team_members — écran Équipe. Managed people, NO login account (ch. 8 pt 1)
--    user_id kept nullable so a future "Équipe" login role needs zero migration.
-- ----------------------------------------------------------------------------
CREATE TABLE team_members (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT UNIQUE REFERENCES users(id) ON DELETE SET NULL,  -- future-proof
  full_name   VARCHAR(160) NOT NULL,
  email       CITEXT,
  phone       VARCHAR(40),
  job_title   VARCHAR(120),                        -- ex: Monteur vidéo, Designer
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_team_updated BEFORE UPDATE ON team_members
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- 4. services — catalogue (Vidéo IA, Création de site, Réseaux sociaux, ...)
--    Needed for "revenu par service" on the dashboard without string matching.
-- ----------------------------------------------------------------------------
CREATE TABLE services (
  id            BIGSERIAL PRIMARY KEY,
  name          VARCHAR(120) NOT NULL UNIQUE,
  description   TEXT,
  default_price NUMERIC(12,3),
  color         VARCHAR(9),                        -- hex used by the revenue bars
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 5. projects
-- ----------------------------------------------------------------------------
CREATE TABLE projects (
  id                      BIGSERIAL PRIMARY KEY,
  client_id               BIGINT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  service_id              BIGINT NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  assigned_team_member_id BIGINT REFERENCES team_members(id) ON DELETE SET NULL,
  created_by_user_id      BIGINT REFERENCES users(id) ON DELETE SET NULL,
  title                   VARCHAR(200) NOT NULL,
  description             TEXT,
  price                   NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (price >= 0),
  currency                CHAR(3) NOT NULL DEFAULT 'TND',
  status                  project_status NOT NULL DEFAULT 'EN_ATTENTE',
  start_date              DATE,
  due_date                DATE,                    -- échéance
  delivered_at            TIMESTAMPTZ,
  closed_at               TIMESTAMPTZ,
  deleted_at              TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_projects_client   ON projects (client_id)  WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_status   ON projects (status)     WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_due      ON projects (due_date)   WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_assignee ON projects (assigned_team_member_id) WHERE deleted_at IS NULL;
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Milestones shown on the client timeline
-- (Brief reçu → Production → Première version → Votre validation → Livraison finale)
CREATE TABLE project_steps (
  id          BIGSERIAL PRIMARY KEY,
  project_id  BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label       VARCHAR(120) NOT NULL,
  position    SMALLINT NOT NULL,
  reached_at  TIMESTAMPTZ,                         -- NULL = not reached yet
  UNIQUE (project_id, position)
);
CREATE INDEX idx_steps_project ON project_steps (project_id);

-- Full status audit trail — "historique des étapes franchies" (acceptance criterion)
CREATE TABLE project_status_history (
  id                  BIGSERIAL PRIMARY KEY,
  project_id          BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  old_status          project_status,
  new_status          project_status NOT NULL,
  changed_by_user_id  BIGINT REFERENCES users(id) ON DELETE SET NULL,
  comment             TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_psh_project ON project_status_history (project_id, created_at);

-- ----------------------------------------------------------------------------
-- 6. files — deliverables and client uploads. Downloads go through the API
-- ----------------------------------------------------------------------------
CREATE TABLE files (
  id                  BIGSERIAL PRIMARY KEY,
  public_id           UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  project_id          BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  uploaded_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  kind                file_kind NOT NULL,          -- LIVRABLE (agency) | ELEMENT_CLIENT
  approval            file_approval,               -- only for LIVRABLE versions
  original_name       VARCHAR(255) NOT NULL,
  storage_key         TEXT NOT NULL UNIQUE,        -- key in blob storage, outside /public
  mime_type           VARCHAR(120) NOT NULL,
  size_bytes          BIGINT NOT NULL CHECK (size_bytes > 0),
  version             SMALLINT NOT NULL DEFAULT 1, -- Version 1, Version 2, ...
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_files_project ON files (project_id, created_at DESC) WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 7. messages — one thread per project (client ↔ admin), read receipts per user
-- ----------------------------------------------------------------------------
CREATE TABLE messages (
  id              BIGSERIAL PRIMARY KEY,
  project_id      BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sender_user_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  body            TEXT NOT NULL CHECK (length(body) > 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_project ON messages (project_id, created_at DESC);

CREATE TABLE message_reads (
  message_id  BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);
CREATE INDEX idx_reads_user ON message_reads (user_id);

-- ----------------------------------------------------------------------------
-- 8. invoices — sequential numbering, guaranteed unique (acceptance criterion:
--    "deux factures ne portent jamais le même numéro")
-- ----------------------------------------------------------------------------
CREATE TABLE invoice_counters (
  year         SMALLINT PRIMARY KEY,
  last_number  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE invoices (
  id                 BIGSERIAL PRIMARY KEY,
  invoice_number     VARCHAR(20) NOT NULL UNIQUE,  -- ex: F-2026-041
  client_id          BIGINT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  project_id         BIGINT REFERENCES projects(id) ON DELETE SET NULL,
  status             invoice_status NOT NULL DEFAULT 'BROUILLON',
  issue_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date           DATE,
  subtotal           NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  vat_rate           NUMERIC(5,2)  NOT NULL DEFAULT 19.00,
  vat_amount         NUMERIC(12,3) NOT NULL DEFAULT 0,
  total              NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (total >= 0),
  currency           CHAR(3) NOT NULL DEFAULT 'TND',
  notes              TEXT,
  sent_at            TIMESTAMPTZ,
  paid_at            TIMESTAMPTZ,
  created_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoices_client ON invoices (client_id);
CREATE INDEX idx_invoices_status ON invoices (status);
CREATE INDEX idx_invoices_issue  ON invoices (issue_date);
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Atomic, gap-safe sequential numbering. Call inside the INSERT transaction.
CREATE OR REPLACE FUNCTION next_invoice_number(p_year SMALLINT)
RETURNS VARCHAR AS $$
DECLARE n INTEGER;
BEGIN
  INSERT INTO invoice_counters (year, last_number) VALUES (p_year, 1)
  ON CONFLICT (year) DO UPDATE SET last_number = invoice_counters.last_number + 1
  RETURNING last_number INTO n;
  RETURN 'F-' || p_year || '-' || lpad(n::text, 3, '0');
END;
$$ LANGUAGE plpgsql;

CREATE TABLE invoice_lines (
  id          BIGSERIAL PRIMARY KEY,
  invoice_id  BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description VARCHAR(300) NOT NULL,
  quantity    NUMERIC(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price  NUMERIC(12,3) NOT NULL CHECK (unit_price >= 0),
  line_total  NUMERIC(12,3) NOT NULL,
  position    SMALLINT NOT NULL DEFAULT 1
);
CREATE INDEX idx_lines_invoice ON invoice_lines (invoice_id);

CREATE TABLE payments (
  id          BIGSERIAL PRIMARY KEY,
  invoice_id  BIGINT NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  amount      NUMERIC(12,3) NOT NULL CHECK (amount > 0),
  method      payment_method NOT NULL,
  reference   VARCHAR(120),                        -- gateway/bank reference
  paid_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_invoice ON payments (invoice_id);

-- ----------------------------------------------------------------------------
-- 9. subscriptions — Starter, Pro, ... with renewal alerts
-- ----------------------------------------------------------------------------
CREATE TABLE subscriptions (
  id              BIGSERIAL PRIMARY KEY,
  client_id       BIGINT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  plan_name       VARCHAR(80) NOT NULL,            -- Starter, Pro, ...
  monthly_amount  NUMERIC(12,3) NOT NULL CHECK (monthly_amount >= 0),
  currency        CHAR(3) NOT NULL DEFAULT 'TND',
  status          subscription_status NOT NULL DEFAULT 'ACTIF',
  auto_renew      BOOLEAN NOT NULL DEFAULT TRUE,
  start_date      DATE NOT NULL,
  renewal_date    DATE NOT NULL,                   -- drives the end-of-period alert
  cancelled_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_subs_client  ON subscriptions (client_id);
CREATE INDEX idx_subs_renewal ON subscriptions (renewal_date) WHERE status = 'ACTIF';
CREATE TRIGGER trg_subs_updated BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- 10. project_requests — "Nouveau projet / devis" form, visible admin-side
-- ----------------------------------------------------------------------------
CREATE TABLE project_requests (
  id                  BIGSERIAL PRIMARY KEY,
  client_id           BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_by_user_id  BIGINT REFERENCES users(id) ON DELETE SET NULL,
  service_id          BIGINT REFERENCES services(id) ON DELETE SET NULL,
  title               VARCHAR(200) NOT NULL,
  description         TEXT,
  status              request_status NOT NULL DEFAULT 'NOUVELLE',
  admin_note          TEXT,
  created_project_id  BIGINT REFERENCES projects(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_requests_status ON project_requests (status);
CREATE TRIGGER trg_requests_updated BEFORE UPDATE ON project_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- 11. notifications — the bell + mirrored by e-mail
-- ----------------------------------------------------------------------------
CREATE TABLE notifications (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type         notification_type NOT NULL,
  title        VARCHAR(200) NOT NULL,
  body         TEXT,
  entity_type  VARCHAR(40),                        -- 'project' | 'invoice' | 'file' | ...
  entity_id    BIGINT,                             -- the alert links to the element
  read_at      TIMESTAMPTZ,
  emailed_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_user_unread ON notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

-- ----------------------------------------------------------------------------
-- 12. audit_logs — credibility/traceability: who did what, when, from where
-- ----------------------------------------------------------------------------
CREATE TABLE audit_logs (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT REFERENCES users(id) ON DELETE SET NULL,
  action       VARCHAR(80) NOT NULL,               -- 'LOGIN', 'INVOICE_CREATE', ...
  entity_type  VARCHAR(40),
  entity_id    BIGINT,
  ip_address   INET,
  user_agent   TEXT,
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_user    ON audit_logs (user_id, created_at DESC);
CREATE INDEX idx_audit_created ON audit_logs (created_at);

-- ----------------------------------------------------------------------------
-- 13. OPTIONAL — chapter 6.2 (VPN blocking). Not in scope until validated in
--     writing. Tables prepared so enabling it later needs no schema change.
-- ----------------------------------------------------------------------------
CREATE TABLE ip_exceptions (
  id          BIGSERIAL PRIMARY KEY,
  ip_address  INET NOT NULL UNIQUE,
  reason      VARCHAR(200),
  added_by    BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE access_denials (
  id          BIGSERIAL PRIMARY KEY,
  ip_address  INET NOT NULL,
  reason      VARCHAR(120),                        -- 'VPN', 'PROXY', ...
  path        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_denials_created ON access_denials (created_at);

-- ----------------------------------------------------------------------------
-- 14. Dashboard views (revenus par mois / par service, charge de l'équipe)
-- ----------------------------------------------------------------------------
CREATE VIEW v_revenue_by_month AS
SELECT date_trunc('month', issue_date)::date AS month,
       SUM(total) FILTER (WHERE status = 'PAYEE')                    AS paid_total,
       SUM(total) FILTER (WHERE status IN ('EN_ATTENTE','EN_RETARD')) AS unpaid_total,
       COUNT(*)                                                       AS invoice_count
FROM invoices
WHERE status <> 'ANNULEE' AND status <> 'BROUILLON'
GROUP BY 1;

CREATE VIEW v_revenue_by_service AS
SELECT s.id AS service_id, s.name AS service_name,
       COUNT(DISTINCT p.id) AS project_count,
       COALESCE(SUM(i.total) FILTER (WHERE i.status = 'PAYEE'), 0) AS paid_total,
       COALESCE(SUM(i.total) FILTER (WHERE i.status IN ('EN_ATTENTE','EN_RETARD')), 0) AS unpaid_total
FROM services s
LEFT JOIN projects p ON p.service_id = s.id AND p.deleted_at IS NULL
LEFT JOIN invoices i ON i.project_id = p.id AND i.status NOT IN ('ANNULEE','BROUILLON')
GROUP BY s.id, s.name;

CREATE VIEW v_team_workload AS
SELECT tm.id AS team_member_id, tm.full_name,
       COUNT(p.id) FILTER (WHERE p.status IN ('EN_ATTENTE','EN_COURS','EN_REVISION')) AS active_projects
FROM team_members tm
LEFT JOIN projects p ON p.assigned_team_member_id = tm.id AND p.deleted_at IS NULL
WHERE tm.is_active
GROUP BY tm.id, tm.full_name;

COMMIT;
