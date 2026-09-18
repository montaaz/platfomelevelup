-- Migration 006 — Le pack devient un projet dès la commande
-- Le client retrouve sa prestation dans « Mes projets » immédiatement, avec un
-- statut explicite tant que le règlement n'est pas confirmé. Il peut donc
-- échanger avec l'équipe sur ce projet sans attendre le paiement.

BEGIN;

-- Nouveau statut, placé avant EN_ATTENTE pour rester lisible dans l'ordre.
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'EN_ATTENTE_PAIEMENT' BEFORE 'EN_ATTENTE';

COMMIT;
