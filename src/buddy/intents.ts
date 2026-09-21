import type { IntentDef } from "./core/router";

/**
 * Les questions que le Dashboard Buddy sait traiter — et rien d'autre.
 *
 * Chaque intention correspond à une méthode fixe de la couche de données et
 * à un gabarit de réponse. Les termes sont donnés en français, avec les
 * équivalents anglais courants. Ce qui ne figure pas ici est refusé.
 */

export type BuddyIntentId =
  | "help" | "summary" | "orders" | "products" | "review" | "threads" | "tasks" | "invoices";

export const INTENTS: IntentDef<BuddyIntentId>[] = [
  {
    id: "help",
    strong: ["aide", "help"],
    phrases: ["que sais tu faire", "que peux tu faire", "quelles questions", "what can you do", "what can i ask"],
  },
  {
    id: "summary",
    strong: ["resume", "summary", "synthese", "apercu", "overview", "bilan", "situation"],
    keywords: ["projet", "projets", "project", "projects", "avancement", "progress", "etat", "status"],
    phrases: [
      "tableau de bord", "dashboard", "ou en sont mes projets", "ou en est mon projet",
      "vue d ensemble", "mes projets", "my projects", "etat des projets", "where are my projects",
    ],
  },
  {
    id: "orders",
    strong: ["commande", "commandes", "order", "orders", "achat", "achats"],
    keywords: ["pack", "packs", "panier", "paye", "payee", "pending", "encaisser", "confirmer"],
    phrases: ["en attente de paiement", "pending orders", "a encaisser", "pack commande", "awaiting payment"],
  },
  {
    id: "products",
    strong: ["produit", "produits", "product", "products", "catalogue", "catalog", "stock", "pack", "packs", "offre", "offres", "tarif", "tarifs", "prix", "pricing"],
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
    phrases: [
      "a faire", "en attente de moi", "en attente de ma part", "que dois je faire", "what should i do",
      "what do i need to do", "pending tasks", "action requise", "qu est ce que j attends", "qu est ce qu on attend de moi",
    ],
  },
  {
    id: "invoices",
    strong: ["facture", "factures", "invoice", "invoices", "facturation", "billing", "impaye", "impayes", "unpaid", "paye", "payees", "paid"],
    keywords: ["montant", "amount", "total", "tnd", "dinars", "paiement", "payment", "regler", "dois", "owe"],
    phrases: ["combien je dois", "what do i owe", "total paye", "total impaye", "reste a payer", "a regler", "to pay"],
  },
];

/** Questions proposées en puces, selon le rôle. */
export const SUGGESTIONS: Record<"ADMIN" | "CLIENT", string[]> = {
  CLIENT: ["Mon résumé", "Mes commandes", "Mes factures", "Mes messages", "Que dois-je faire ?", "Vos offres"],
  ADMIN: ["Résumé de l'agence", "Commandes à encaisser", "Factures en retard", "À vérifier", "Dernières conversations", "Tâches en attente"],
};
