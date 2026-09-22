import type { IntentDef } from "./core/router";

/**
 * Les questions que le Dashboard Buddy sait traiter — et rien d'autre.
 *
 * Chaque intention correspond à une méthode fixe de la couche de données et
 * à un gabarit de réponse. Les termes sont donnés en français et en anglais,
 * avec quelques mots du parler tunisien. Le routeur tolère pluriels, dérivés
 * et fautes de frappe (voir core/normalize) : inutile de lister chaque forme.
 */

export type BuddyIntentId =
  | "help" | "summary" | "project" | "deadline" | "deliverables" | "download" | "revision" | "approve"
  | "orders" | "products" | "review" | "threads" | "tasks" | "invoices" | "profile" | "human" | "newProject";

export const INTENT_IDS: BuddyIntentId[] = [
  "help", "summary", "project", "deadline", "deliverables", "download", "revision", "approve",
  "orders", "products", "review", "threads", "tasks", "invoices", "profile", "human", "newProject",
];

/** Intentions qui portent sur un projet précis : le bot doit savoir lequel. */
export const PROJECT_INTENTS: ReadonlySet<BuddyIntentId> = new Set(["project", "deadline", "deliverables", "download", "revision", "approve"]);

export const INTENTS: IntentDef<BuddyIntentId>[] = [
  {
    id: "help",
    strong: ["aide", "help", "chnowa", "chnia", "chnoua"],
    phrases: ["que sais tu faire", "que peux tu faire", "quelles questions", "what can you do", "what can i ask", "chnowa tnajem"],
  },
  {
    id: "human",
    strong: ["humain", "human", "quelqu", "someone", "conseiller", "conseillere", "agent", "personne", "person", "operateur"],
    keywords: ["parler", "talk", "speak", "chat", "appeler", "call", "joindre", "contacter", "contact", "reach", "vrai", "real", "equipe", "team"],
    phrases: [
      "parler a un humain", "parler a quelqu un", "parler a une personne", "parler a l equipe", "un vrai humain",
      "talk with a human", "talk to a human", "talk to someone", "speak to someone", "speak with someone",
      "speak to a human", "real person", "contact the team", "joindre l equipe", "contacter l equipe",
    ],
  },
  {
    id: "summary",
    strong: ["resume", "summary", "synthese", "apercu", "overview", "bilan"],
    keywords: ["projets", "projects", "situation", "global"],
    phrases: ["tableau de bord", "dashboard", "vue d ensemble", "mes projets", "my projects", "all my projects", "tous mes projets"],
  },
  {
    id: "project",
    strong: ["etape", "etapes", "step", "steps", "avancement", "progression", "progress", "statut", "status", "avance"],
    keywords: ["projet", "projets", "project", "projects", "video", "site", "campagne", "shooting", "en cours"],
    phrases: [
      "ou en est", "ou en sont", "where is", "how far", "le projet", "du projet", "the project", "mon projet", "my project",
      "ca avance", "quoi de neuf", "what s new", "ou ca en est",
    ],
  },
  {
    id: "deadline",
    strong: ["echeance", "deadline", "delai", "delais", "due", "livraison", "delivery"],
    keywords: ["quand", "when", "date", "pret", "prete", "ready", "fini", "finished", "termine", "livre", "delivered", "prevu", "expected"],
    phrases: [
      "quand est ce que", "ce sera pret", "sera pret", "sera livre", "when is it due", "when will it be ready",
      "when will it be", "date de livraison", "due date", "delivery date", "pour quand", "quand est prevu",
    ],
  },
  {
    id: "deliverables",
    strong: ["livrable", "livrables", "deliverable", "deliverables", "fichier", "fichiers", "file", "files", "document", "documents", "maquette", "maquettes"],
    keywords: ["disponible", "disponibles", "available", "recu", "recus", "received", "envoye", "envoyes", "version", "versions"],
    phrases: ["quels fichiers", "what files", "which files", "fichiers disponibles", "available files", "ce que vous avez envoye", "what you sent"],
  },
  {
    id: "download",
    strong: ["telecharger", "telechargement", "download", "downloads", "recuperer"],
    keywords: ["fichier", "fichiers", "file", "files", "livrable", "livrables", "video", "pdf", "zip", "lien", "link"],
    phrases: ["puis je telecharger", "can i download", "what can i download", "que puis je telecharger", "lien de telechargement", "download link"],
  },
  {
    id: "revision",
    strong: ["revision", "revisions", "reviser", "modification", "modifications", "modifier", "changement", "changements", "corriger", "correction", "corrections", "retouche", "retouches"],
    keywords: ["demander", "request", "ask", "change", "changes", "fix", "livrable", "deliverable", "version", "pas content", "not happy"],
    phrases: ["demander une revision", "request a revision", "demande de revision", "je veux des modifications", "i want changes", "ca ne me convient pas", "not satisfied"],
  },
  {
    id: "approve",
    strong: ["approuver", "approuve", "approve", "approved", "valider", "validation", "validate", "accepter", "accept"],
    keywords: ["livrable", "deliverable", "version", "ok", "bon", "good", "parfait", "perfect", "convient"],
    phrases: ["approuver le livrable", "approve the deliverable", "c est valide", "je valide", "i approve", "ca me convient", "it s good"],
  },
  {
    id: "orders",
    strong: ["commande", "commandes", "order", "orders", "achat", "achats", "commanda", "commandet"],
    keywords: ["pack", "packs", "panier", "paye", "payee", "pending", "encaisser", "confirmer"],
    phrases: ["en attente de paiement", "pending orders", "a encaisser", "pack commande", "awaiting payment", "my orders", "mes commandes"],
  },
  {
    id: "products",
    strong: [
      "produit", "produits", "product", "products", "catalogue", "catalog", "stock", "pack", "packs", "offre", "offres",
      "tarif", "tarifs", "prix", "price", "prices", "pricing", "9adech", "kadech", "9addech",
      "comparer", "compare", "difference", "recommande", "recommend", "conseil", "conseille",
      "budget", "mieux", "meilleur", "better", "best",
      "video", "videos", "shooting", "site", "logo", "visuels", "visuel",
    ],
    keywords: [
      "service", "services", "abonnement", "abonnements", "subscription", "formule", "web", "website", "photo", "photos",
      "reseaux", "social", "sociaux", "instagram", "facebook", "linkedin", "tiktok", "contenu", "contenus", "content",
      "collection", "collections", "business", "entreprise", "boutique", "clothing", "vetements", "marque", "brand", "offer", "offers",
    ],
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
    strong: ["message", "messages", "conversation", "conversations", "discussion", "discussions", "messagerie"],
    keywords: ["equipe", "team", "repondu", "reponse", "reply", "lu", "lus", "envoye", "sent", "dernier", "derniers", "latest", "last", "recu", "received"],
    phrases: [
      "non lus", "unread", "dernieres discussions", "dernieres conversations", "recent conversations", "derniers messages",
      "recent messages", "latest message", "last message", "dernier message", "what did the team send", "qu a envoye l equipe",
      "ce que l equipe a envoye", "team message", "message de l equipe",
    ],
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
    strong: ["facture", "factures", "invoice", "invoices", "facturation", "billing", "impaye", "impayes", "impayee", "unpaid", "paye", "payees", "paid", "fatoura", "fatourat", "flous"],
    keywords: ["montant", "amount", "total", "tnd", "dinars", "paiement", "payment", "regler", "dois", "owe", "9adech", "kadech", "reste", "remaining"],
    phrases: ["combien je dois", "what do i owe", "total paye", "total impaye", "reste a payer", "a regler", "to pay", "9adech lezem", "9adech nkhalles", "payment status", "statut de paiement"],
  },
  {
    id: "profile",
    strong: ["profil", "profile", "compte", "account", "coordonnees", "adresse", "address", "email", "mail", "telephone", "phone", "identifiants", "password"],
    keywords: ["mon", "my", "modifier", "update", "changer", "change", "mot de passe", "informations", "information", "details"],
    phrases: ["mon profil", "my profile", "mon compte", "my account", "mes coordonnees", "my details", "changer mon mot de passe", "change my password", "mes informations"],
  },
  {
    id: "newProject",
    strong: ["creer", "lancer", "demarrer", "create", "start", "demande"],
    keywords: ["nouveau", "nouvelle", "new", "projet", "projets", "project", "besoin", "need", "veux", "want", "voudrais", "campagne", "identite"],
    phrases: ["nouveau projet", "new project", "creer un projet", "create a project", "lancer un projet", "demande de projet", "demarrer un projet", "start a project", "another project", "autre projet"],
  },
];
