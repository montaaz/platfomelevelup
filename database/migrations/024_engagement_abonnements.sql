-- Promotions des abonnements (notes de Sarra, §02) : engagement 6 mois = 1 mois
-- offert, 12 mois = 2 mois offerts. Le nombre de mois choisi est porté par la
-- commande (et par un paiement fait avant création du compte), puis par l'abonnement.
ALTER TABLE orders           ADD COLUMN IF NOT EXISTS commitment_months SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE prepaid_payments ADD COLUMN IF NOT EXISTS commitment_months SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE subscriptions    ADD COLUMN IF NOT EXISTS commitment_months SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE subscriptions    ADD COLUMN IF NOT EXISTS free_months       SMALLINT NOT NULL DEFAULT 0;
