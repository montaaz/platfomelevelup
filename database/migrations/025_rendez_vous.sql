-- Rendez-vous téléphoniques réservés par les clients (notes de Sarra, §01) :
-- seuls les créneaux libres sont proposés ; le calendrier « LevelUpAI Assistant »
-- s'abonne au flux iCal des rendez-vous, et ses propres occupations (flux iCal
-- secret du calendrier) sont retirées des créneaux proposés.
CREATE TABLE IF NOT EXISTS appointments (
  id                BIGSERIAL PRIMARY KEY,
  client_id         BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  booked_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  starts_at         TIMESTAMPTZ NOT NULL,
  ends_at           TIMESTAMPTZ NOT NULL,
  need              VARCHAR(40),
  topic             VARCHAR(200),
  status            VARCHAR(12) NOT NULL DEFAULT 'CONFIRME',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Un créneau ne peut être réservé qu'une fois.
CREATE UNIQUE INDEX IF NOT EXISTS uq_appointments_slot ON appointments (starts_at) WHERE status = 'CONFIRME';
CREATE INDEX IF NOT EXISTS idx_appointments_client ON appointments (client_id, starts_at);
