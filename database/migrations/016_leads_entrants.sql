-- Migration 016 — Leads entrants des réseaux sociaux et de l'e-mail
-- Chaque message reçu par l'automatisation n8n (Instagram, Facebook,
-- LinkedIn, e-mail…) et traité par l'assistant IA de la plateforme est
-- conservé ici : qui a écrit, sur quel canal, quoi, et ce qui a été répondu.
-- L'équipe retrouve ces contacts dans l'administration (menu « Leads »).

BEGIN;

CREATE TABLE IF NOT EXISTS inbound_leads (
  id            BIGSERIAL PRIMARY KEY,
  channel       VARCHAR(20) NOT NULL,            -- instagram, facebook, linkedin, tiktok, email, site
  external_id   VARCHAR(160),                    -- identifiant de l'expéditeur chez la plateforme sociale
  display_name  VARCHAR(160),
  contact       VARCHAR(254),                    -- e-mail ou téléphone s'il est connu
  message       TEXT NOT NULL,
  reply         TEXT,
  answered_by_ai BOOLEAN NOT NULL DEFAULT TRUE,
  lang          CHAR(2),
  thread_ref    VARCHAR(160),                    -- conversation / post / fil e-mail
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inbound_leads_channel ON inbound_leads (channel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbound_leads_external ON inbound_leads (channel, external_id);

COMMIT;
