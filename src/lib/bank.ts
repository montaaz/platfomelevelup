/**
 * Coordonnées bancaires de l'agence pour le paiement par virement
 * (relevé d'identité bancaire Attijari bank, agence Les Jasmins).
 * Affichées au client avec un bouton « copier » ; à modifier ici seulement.
 */
export const BANK_ACCOUNT = {
  holder: "STE LEVEL UP COMMUNICATION",
  bank: "Attijari bank — Agence Les Jasmins",
  rib: "04 058 1440096358601 27",
  iban: "TN59 0405 8144 0096 3586 0127",
  bic: "BSTUTNTT",
  currency: "TND",
};

/** Libellé que le client indique sur son virement : il relie le virement à la commande. */
export const transferLabel = (orderId: string | bigint) => `LEVELUP-${orderId}`;
