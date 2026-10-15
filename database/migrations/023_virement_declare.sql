-- Le client peut déclarer son virement sans justificatif (référence facultative) :
-- les colonnes du fichier deviennent optionnelles.
ALTER TABLE payment_proofs
  ALTER COLUMN original_name DROP NOT NULL,
  ALTER COLUMN storage_key   DROP NOT NULL,
  ALTER COLUMN mime_type     DROP NOT NULL,
  ALTER COLUMN size_bytes    DROP NOT NULL;
