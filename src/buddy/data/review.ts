/**
 * Règles « à vérifier manuellement ».
 *
 * Une seule définition, partagée par les deux adaptateurs, pour que les tests
 * sur fixtures vérifient exactement ce que la base réelle appliquera. Chaque
 * règle renvoie une phrase courte disant ce qui manque ; rien n'est comblé
 * ni supposé.
 */

const DAY = 86_400_000;

/** Méthodes de paiement pour lesquelles une référence est attendue. */
const NEEDS_REFERENCE = new Set(["VIREMENT", "CHEQUE"]);

export type OrderLike = {
  status: string;
  createdAt: Date;
  isMonthly: boolean;
  projectId: string | null;
  invoiceId: string | null;
  paymentMethod: string | null;
  paymentReference: string | null;
};

export type PaymentLike = { method: string; reference: string | null };

export type InvoiceLike = {
  status: string;
  dueDate: Date | null;
  lineCount: number;
  payments: PaymentLike[];
};

/** Commande en attente depuis plus d'une semaine, ou payée sans ses rattachements. */
export function reviewOrder(o: OrderLike, now: Date): string[] {
  const reasons: string[] = [];
  if (o.status === "EN_ATTENTE_PAIEMENT") {
    const days = Math.floor((now.getTime() - o.createdAt.getTime()) / DAY);
    if (days > 7) reasons.push(`en attente de paiement depuis ${days} jours`);
  }
  if (o.status === "PAYEE") {
    if (!o.invoiceId) reasons.push("facture non rattachée");
    if (!o.isMonthly && !o.projectId) reasons.push("projet non rattaché");
    if (o.paymentMethod && NEEDS_REFERENCE.has(o.paymentMethod) && !o.paymentReference) {
      reasons.push("référence de paiement manquante");
    }
  }
  return reasons;
}

/** Facture échue, payée sans paiement enregistré, ou sans contenu. */
export function reviewInvoice(i: InvoiceLike, now: Date): string[] {
  const reasons: string[] = [];
  if (i.status === "EN_RETARD") reasons.push("échéance dépassée");
  else if (i.status === "EN_ATTENTE" && i.dueDate && i.dueDate.getTime() < now.getTime()) {
    reasons.push("échéance dépassée, statut non mis à jour");
  }
  if (i.status === "PAYEE" && i.payments.length === 0) reasons.push("paiement non enregistré");
  for (const p of i.payments) {
    if (NEEDS_REFERENCE.has(p.method) && !p.reference) {
      reasons.push("référence de paiement manquante");
      break;
    }
  }
  if (i.status !== "BROUILLON" && i.lineCount === 0) reasons.push("aucune ligne de facturation");
  return reasons;
}
