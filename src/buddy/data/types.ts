import type { Ctx } from "@/server/context";
import type { StatusToken } from "../filters";

/**
 * Contrat de la couche de données du chatbot.
 *
 * Le routeur ne connaît que cette interface : il demande « les commandes de
 * ce contexte », jamais une table ni une requête. Deux implémentations —
 * Prisma sur la base réelle, JSON sur des fixtures — et le même cloisonnement
 * dans les deux : un client ne reçoit que ce qui lui appartient.
 *
 * Chaque enregistrement porte `review`, la liste de ce qui lui manque pour
 * être complet. Vide, il est sain ; sinon, il est signalé pour vérification
 * manuelle plutôt que présenté comme fiable.
 */

export type BuddyCtx = Ctx;

/** Ce qui manque à un enregistrement pour être complet. Vide = rien à signaler. */
export type Review = string[];

/**
 * Paramètres qu'une question peut poser. Tous validés en amont : le statut
 * vient d'une liste fermée, les dates sont calculées, le nom et la référence
 * sont bornés. Aucun n'est jamais interpolé dans du SQL.
 */
export type QueryFilter = {
  /** Client visé, par un administrateur seulement. */
  company?: string;
  status?: StatusToken;
  since?: Date;
  until?: Date;
  /** Libellé humain de la période, pour l'en-tête de la réponse. */
  label?: string;
  reference?: string;
  name?: string;
  limit?: number;
};

/** Ancien nom, conservé pour les appels existants. */
export type EntityFilter = QueryFilter;

export type SummaryDTO =
  | {
      role: "CLIENT";
      activeProjects: { title: string; status: string; nextStep: string | null; progress: number }[];
      unpaidCount: number;
      unpaidTotal: number;
      unread: number;
      pendingOrders: number;
    }
  | {
      role: "ADMIN";
      revenueMonth: number;
      projectsInProgress: number;
      unpaidCount: number;
      unpaidTotal: number;
      revisionRequests: number;
      pendingOrders: number;
      newRequests: number;
    };

export type OrderDTO = {
  id: string;
  clientCompany: string;
  packName: string;
  amount: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
  paymentMethod: string | null;
  review: Review;
};

export type ProductDTO = {
  code: string;
  name: string;
  description: string | null;
  price: number;
  isMonthly: boolean;
};

export type ReviewItemDTO = {
  kind: "FACTURE" | "COMMANDE";
  ref: string;
  clientCompany: string;
  reasons: string[];
};

export type ThreadDTO = {
  projectTitle: string;
  clientCompany: string;
  lastMessage: string;
  lastSenderName: string;
  unread: number;
  lastAt: string;
};

export type TaskDTO = {
  label: string;
  clientCompany: string;
};

export type InvoiceDTO = {
  number: string;
  clientCompany: string;
  projectTitle: string | null;
  status: string;
  total: number;
  issueDate: string;
  dueDate: string | null;
  paidAt: string | null;
  review: Review;
};

export type ProjectDTO = {
  id: string;
  title: string;
  clientCompany: string;
  serviceName: string | null;
  status: string;
  progress: number;
  nextStep: string | null;
  steps: { label: string; reachedAt: string | null }[];
  startDate: string | null;
  dueDate: string | null;
};

export interface BuddyDataSource {
  summary(ctx: BuddyCtx): Promise<SummaryDTO>;
  orders(ctx: BuddyCtx, filter?: QueryFilter): Promise<OrderDTO[]>;
  products(): Promise<ProductDTO[]>;
  reviewItems(ctx: BuddyCtx, filter?: QueryFilter): Promise<ReviewItemDTO[]>;
  threads(ctx: BuddyCtx, filter?: QueryFilter): Promise<ThreadDTO[]>;
  tasks(ctx: BuddyCtx, filter?: QueryFilter): Promise<TaskDTO[]>;
  invoices(ctx: BuddyCtx, filter?: QueryFilter): Promise<InvoiceDTO[]>;
  projects(ctx: BuddyCtx, filter?: QueryFilter): Promise<ProjectDTO[]>;
}
