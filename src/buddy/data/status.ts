import type { StatusToken } from "../filters";

/**
 * Un même mot de la question (« payée », « en attente ») ne désigne pas le
 * même statut selon l'entité. Ces tables font la correspondance, et une
 * valeur sans équivalent pour l'entité est simplement ignorée.
 */

export function invoiceStatus(s?: StatusToken): "PAYEE" | "EN_ATTENTE" | "EN_RETARD" | "ANNULEE" | undefined {
  switch (s) {
    case "PAYEE": case "EN_ATTENTE": case "EN_RETARD": case "ANNULEE": return s;
    default: return undefined;
  }
}

export function orderStatus(s?: StatusToken): "PAYEE" | "EN_ATTENTE_PAIEMENT" | "ANNULEE" | undefined {
  switch (s) {
    case "PAYEE": return "PAYEE";
    case "EN_ATTENTE": case "EN_RETARD": return "EN_ATTENTE_PAIEMENT";
    case "ANNULEE": return "ANNULEE";
    default: return undefined;
  }
}

export function projectStatus(
  s?: StatusToken,
): "EN_ATTENTE_PAIEMENT" | "EN_ATTENTE" | "EN_COURS" | "EN_REVISION" | "LIVRE" | "CLOTURE" | undefined {
  switch (s) {
    case "EN_ATTENTE": case "EN_COURS": case "EN_REVISION": case "LIVRE": case "CLOTURE": return s;
    default: return undefined;
  }
}

/** Fenêtre de dates Prisma, ou rien. */
export function dateRange(since?: Date, until?: Date): { gte?: Date; lt?: Date } | undefined {
  if (!since && !until) return undefined;
  return { ...(since ? { gte: since } : {}), ...(until ? { lt: until } : {}) };
}

/** Le même test, en mémoire, pour les fixtures. */
export function inRange(iso: string | null | undefined, since?: Date, until?: Date): boolean {
  if (!since && !until) return true;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return (!since || t >= since.getTime()) && (!until || t < until.getTime());
}
