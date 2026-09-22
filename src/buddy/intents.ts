import type { IntentDef } from "./core/router";

/**
 * Les questions que le Dashboard Buddy sait traiter — et rien d'autre.
 *
 * Chaque intention correspond à une méthode fixe de la couche de données et
 * à un gabarit de réponse. Les termes sont donnés en français, avec les
 * équivalents anglais courants et quelques mots du parler tunisien
 * (« fatoura », « 9adech », « flous »). Ce qui ne figure pas ici est refusé.
 */

export type BuddyIntentId =
  | "help" | "summary" | "orders" | "products" | "review" | "threads" | "tasks" | "invoices" | "project";

export const INTENT_IDS: BuddyIntentId[] = [
  "help", "summary", "orders", "products", "review", "threads", "tasks", "invoices", "project",
];

export const INTENTS: IntentDef<BuddyIntentId>[] = [
  {
    id: "help",
    strong: ["aide", "help", "chnowa", "chnia", "chnoua"],
    phrases: ["que sais tu faire", "que peux tu faire", "quelles questions", "what can you do", "what can i ask", "chnowa tnajem"],
  },
  {
    id: "summary",
    strong: ["resume", "summary", "synthese", "apercu", "overview", "bilan", "situation"],
    keywords: ["projet", "projets", "project", "projects", "avancement", "progress", "etat", "status"],
    phrases: [
      "tableau de bord", "dashboard", "vue d ensemble", "mes projets", "my projects", "etat des projets",
      "where are my projects",
    ],
  },
  {
    id: "project",
    strong: ["etape", "etapes", "step", "steps", "avancement", "progression"],
    keywords: ["projet", "projets", "project", "projects", "livraison", "delivery", "echeance", "deadline"],
    phrases: ["ou en est", "where is", "how far", "le projet", "du projet", "the project"],
  },
  {
    id: "orders",
    strong: ["commande", "commandes", "order", "orders", "achat", "achats", "commanda", "commandet"],
    keywords: ["pack", "packs", "panier", "paye", "payee", "pending", "encaisser", "confirmer"],
    phrases: ["en attente de paiement", "pending orders", "a encaisser", "pack commande", "awaiting payment"],
  },
  {
    id: "products",
    strong: ["produit", "produits", "product", "products", "catalogue", "catalog", "stock", "pack", "packs", "offre", "offres", "tarif", "tarifs", "prix", "pricing", "9adech", "kadech", "9addech"],
    keywords: ["service", "services", "abonnement", "abonnements", "formule"],
  },
  {
    id: "review",
    strong: ["verifier", "verification", "review", "incomplet", "incomplets", "incomplete", "anomalie", "anomalies", "recu", "recus", "receipt", "receipts"],
    keywords: ["manuel", "manuelle", "manual", "retard", "late", "manquant", "manquante", "missing"],
    phrases: [
      "a verifier", "verification manuelle", "manual review", "needs review", "to review",
      "en retard", "overdue", "paiements incomplets", "reference manquante", "missing reference",
    ],
  },
  {
    id: "threads",
    strong: ["message", "messages", "conversation", "conversations", "discussion", "discussions", "messagerie", "chat"],
    keywords: ["equipe", "team", "repondu", "reponse", "reply", "lu", "lus"],
    phrases: ["non lus", "unread", "dernieres discussions", "dernieres conversations", "recent conversations", "derniers messages", "recent messages"],
  },
  {
    id: "tasks",
    strong: ["tache", "taches", "task", "tasks", "todo", "faire"],
    keywords: ["attente", "pending", "attend", "valider", "approuver", "approve", "action", "actions"],
    exclude: ["faites"],
    phrases: [
      "a faire", "en attente de moi", "en attente de ma part", "que dois je faire", "what should i do",
      "what do i need to do", "pending tasks", "action requise", "qu est ce que j attends", "qu est ce qu on attend de moi",
      "chnowa lezem", "chnia lezem",
    ],
  },
  {
    id: "invoices",
    strong: ["facture", "factures", "invoice", "invoices", "facturation", "billing", "impaye", "impayes", "unpaid", "paye", "payees", "paid", "fatoura", "fatourat", "flous"],
    keywords: ["montant", "amount", "total", "tnd", "dinars", "paiement", "payment", "regler", "dois", "owe", "9adech", "kadech"],
    phrases: ["combien je dois", "what do i owe", "total paye", "total impaye", "reste a payer", "a regler", "to pay", "9adech lezem", "9adech nkhalles"],
  },
];

/** Questions proposées en puces, selon le rôle. */
export const SUGGESTIONS: Record<"ADMIN" | "CLIENT", string[]> = {
  CLIENT: ["Mon résumé", "Mes commandes", "Mes factures", "Mes messages", "Que dois-je faire ?", "Vos offres"],
  ADMIN: ["Résumé de l'agence", "Commandes à encaisser", "Factures en retard", "À vérifier", "Dernières conversations", "Tâches en attente"],
};
