import { prisma } from "@/lib/prisma";
import { notifyTeamByEmail } from "@/lib/mail";
import { stripPublicPort } from "@/lib/publicUrl";
import { buildPaymentForm, readMoneticoConfig, readNotification, tndToEur } from "@/lib/monetico";
import { clientScope, ForbiddenError, ValidationError, type Ctx } from "@/server/context";
import { currencyForCountryCode } from "@/lib/region";
import { commitmentAmount, commitmentFor } from "@/lib/commitment";
import { findPackByCode, settleOrder } from "@/server/services/orders";

/**
 * Carte bancaire en euros (Monetico) pour les clients hors Tunisie.
 * Deux départs possibles : une commande existante (espace client) ou le
 * panier du site vitrine (compte créé après paiement, comme pour ClicToPay).
 * L'encaissement se fait UNIQUEMENT sur la notification serveur de Monetico.
 */

export const MONETICO_NOTIFY_PATH = "/api/paiement/monetico/notification";
const RETURN_PATH = "/api/paiement/monetico/retour";

const base = () => stripPublicPort(process.env.APP_URL ?? "https://levelupia.app");
const ref = (prefix: string, id: bigint) => `${prefix}${id}${Date.now().toString(36).slice(-5)}`.replace(/[^A-Za-z0-9]/g, "").slice(0, 12);

type Form = { action: string; fields: Record<string, string>; amountEur: number; amountTnd: number; label: string; currency?: "EUR" | "USD" };

/** Formulaire Monetico pour une commande en attente du client connecté. */
export async function moneticoFormForOrder(ctx: Ctx, orderId?: bigint): Promise<Form> {
  const cfg = readMoneticoConfig();
  if (!cfg) throw new ValidationError("Paiement par carte indisponible.");
  const clientId = clientScope(ctx);
  const order = await prisma.order.findFirst({
    where: { clientId, status: "EN_ATTENTE_PAIEMENT", ...(orderId != null ? { id: orderId } : {}) },
    orderBy: { createdAt: "desc" },
    include: { pack: true, client: true },
  });
  if (!order) throw new ValidationError("Aucune commande en attente de paiement.");

  // La commande est déjà dans la devise du client (EUR ou USD, même nombre que le prix).
  const currency: "EUR" | "USD" = order.currency === "USD" ? "USD" : "EUR";
  const amountEur = order.currency === "USD" || order.currency === "EUR" ? Number(order.amount) : tndToEur(order.amount.toString());
  const reference = ref("O", order.id);
  await prisma.order.update({ where: { id: order.id }, data: { gatewayOrderId: reference, gatewayAmount: amountEur, gatewayCurrency: currency } });
  const user = await prisma.user.findFirst({ where: { id: ctx.userId }, select: { email: true } });
  const { action, fields } = buildPaymentForm(
    {
      reference,
      amountEur,
      currency,
      email: user?.email ?? order.client.email ?? "contact@levelupia.agency",
      lang: "FR",
      urlRetourOk: `${base()}${RETURN_PATH}?ref=${reference}&ok=1`,
      urlRetourErr: `${base()}${RETURN_PATH}?ref=${reference}&ok=0`,
      texteLibre: `order:${order.id}`,
      billing: {
        name: order.client.contactName,
        addressLine1: order.client.billingAddress ?? order.client.address ?? undefined,
        city: order.client.city ?? undefined,
        country: countryCode(order.client.country, order.client.detectedCountryCode),
      },
    },
    cfg,
  );
  return { action, fields, amountEur, amountTnd: Number(order.amount), label: order.pack.name, currency };
}

/** Formulaire Monetico pour une offre du panier (avant création du compte). */
export async function moneticoFormForPack(packCode: string, countryCodeHint: string | null, commitmentMonths = 1): Promise<Form> {
  const cfg = readMoneticoConfig();
  if (!cfg) throw new ValidationError("Paiement par carte indisponible.");
  const pack = await findPackByCode(packCode);
  const currency: "EUR" | "USD" = currencyForCountryCode(countryCodeHint) === "USD" ? "USD" : "EUR";
  // Abonnement : engagement choisi (6 mois = 1 offert, 12 mois = 2 offerts), payé d'avance.
  const engagement = pack.isMonthly ? commitmentFor(commitmentMonths) : commitmentFor(1);
  const total = commitmentAmount(Number(pack.price), engagement.months);
  const amountEur = tndToEur(String(total));
  const row = await prisma.prepaidPayment.create({ data: { packId: pack.id, amount: total, currency: pack.currency, gatewayAmount: amountEur, gatewayCurrency: currency, commitmentMonths: engagement.months } });
  const reference = ref("P", row.id);
  await prisma.prepaidPayment.update({ where: { id: row.id }, data: { gatewayOrderId: reference } });
  const { action, fields } = buildPaymentForm(
    {
      reference,
      amountEur,
      currency,
      email: "contact@levelupia.agency",
      lang: "FR",
      urlRetourOk: `${base()}${RETURN_PATH}?ref=${reference}&ok=1`,
      urlRetourErr: `${base()}${RETURN_PATH}?ref=${reference}&ok=0`,
      texteLibre: `prepaid:${row.id}`,
      billing: { country: countryCodeHint && /^[A-Za-z]{2}$/.test(countryCodeHint) ? countryCodeHint : "FR" },
    },
    cfg,
  );
  return { action, fields, amountEur, amountTnd: Number(pack.price), label: pack.name, currency };
}

function countryCode(country: string | null, detected: string | null): string {
  if (detected && /^[A-Za-z]{2}$/.test(detected)) return detected;
  const map: Record<string, string> = { france: "FR", tunisie: "TN", belgique: "BE", suisse: "CH", canada: "CA", allemagne: "DE", espagne: "ES", italie: "IT", maroc: "MA", algérie: "DZ" };
  return map[(country ?? "").toLowerCase()] ?? "FR";
}

export type NotifyResult = "PAID" | "IGNORED" | "INVALID";

/**
 * Interface retour (serveur à serveur) : le sceau est vérifié, puis la
 * commande (ou le paiement avant inscription) est encaissée. Sans effet si
 * déjà encaissée. Retourne INVALID si le sceau est faux — Monetico réessaie.
 */
export async function handleMoneticoNotification(fields: Record<string, string>): Promise<NotifyResult> {
  const cfg = readMoneticoConfig();
  if (!cfg) return "INVALID";
  const n = readNotification(fields, cfg);
  if (!n.valid) {
    console.warn("[monetico] notification au sceau invalide, référence", fields.reference);
    return "INVALID";
  }
  if (!n.paid) {
    console.info(`[monetico] ${n.reference} : ${n.codeRetour}${n.motifRefus ? ` (${n.motifRefus})` : ""}`);
    return "IGNORED";
  }
  const reference = `Monetico ${n.reference}${n.authorization ? ` / aut. ${n.authorization}` : ""} · ${n.amountEur?.toFixed(2)} ${n.currency}`;

  const order = await prisma.order.findUnique({ where: { gatewayOrderId: n.reference }, include: { pack: true, client: true } });
  if (order) {
    if (order.status === "PAYEE") return "PAID";
    if (n.amountEur !== Number(order.gatewayAmount ?? -1) || n.currency !== (order.gatewayCurrency ?? "EUR")) {
      console.error(`[monetico] montant inattendu pour la commande ${order.id}: ${n.amountEur} ${n.currency}`);
      return "INVALID";
    }
    if (await settleOrder(order.id, "EN_LIGNE", reference, null)) {
      notifyTeamByEmail(
        `Paiement carte accepté — ${order.pack.name}`,
        `${order.client.companyName} a réglé ${n.amountEur?.toFixed(2)} € (${Number(order.amount).toFixed(3)} TND) par carte via Monetico (commande n° ${order.id}). Référence : ${reference}.`,
      );
    }
    return "PAID";
  }

  const prepaid = await prisma.prepaidPayment.findUnique({ where: { gatewayOrderId: n.reference }, include: { pack: true } });
  if (prepaid) {
    if (prepaid.status !== "EN_ATTENTE") return "PAID";
    if (n.amountEur !== Number(prepaid.gatewayAmount ?? -1) || n.currency !== (prepaid.gatewayCurrency ?? "EUR")) return "INVALID";
    const marked = await prisma.prepaidPayment.updateMany({ where: { id: prepaid.id, status: "EN_ATTENTE" }, data: { status: "PAYEE", paymentReference: reference, paidAt: new Date() } });
    if (marked.count > 0) {
      notifyTeamByEmail(
        `Paiement carte accepté — ${prepaid.pack.name}`,
        `Un visiteur a réglé ${n.amountEur?.toFixed(2)} € par carte via Monetico depuis le panier du site (paiement n° ${prepaid.id}). Référence : ${reference}. La commande apparaîtra dans son espace dès la création de son compte.`,
      );
    }
    return "PAID";
  }
  console.warn("[monetico] notification pour une référence inconnue", n.reference);
  return "IGNORED";
}

/** Retour du client (url_retour_ok / url_retour_err) : où l'envoyer. */
export async function moneticoReturnLocation(reference: string, ok: boolean): Promise<{ location: string; prepaid?: { id: string; packCode: string } }> {
  if (!/^[A-Za-z0-9]{1,12}$/.test(reference)) return { location: "/paiement/echec" };
  const order = await prisma.order.findUnique({ where: { gatewayOrderId: reference }, select: { status: true } });
  if (order) return { location: order.status === "PAYEE" ? "/paiement/succes" : ok ? "/paiement/echec?motif=en_cours" : "/paiement/echec" };
  const prepaid = await prisma.prepaidPayment.findUnique({ where: { gatewayOrderId: reference }, include: { pack: true } });
  if (prepaid) {
    if (prepaid.status === "PAYEE") return { location: "/paiement/succes", prepaid: { id: prepaid.id.toString(), packCode: prepaid.pack.code } };
    if (prepaid.status === "RATTACHEE") return { location: "/paiement/succes" };
    return { location: ok ? "/paiement/echec?motif=en_cours" : "/paiement/echec" };
  }
  return { location: "/paiement/echec" };
}

export function moneticoAvailable(): boolean {
  return readMoneticoConfig() !== null;
}
