import { prisma } from "@/lib/prisma";
import { ValidationError } from "@/server/context";
import { fetchPaymentStatus, registerPayment, toMillimes, TND_NUMERIC } from "@/lib/clictopay";
import { notifyTeamByEmail } from "@/lib/mail";
import { stripPublicPort } from "@/lib/publicUrl";
import {
  createOrderForClient,
  finalizeGatewayPayment,
  findPackByCode,
  settleOrder,
  PAYMENT_FAIL_PATH,
  PAYMENT_RETURN_PATH,
  type GatewayOutcome,
} from "@/server/services/orders";

/**
 * Paiement depuis le panier du site vitrine, AVANT la création du compte.
 *
 *   panier (vitrine) → banque → retour → inscription ou connexion → commande payée
 *
 * Tant que le visiteur n'a pas de compte, son paiement vit dans
 * `prepaid_payments`. Un cookie signé le suit jusqu'à l'inscription, où il
 * est rattaché au client et devient une commande payée, avec projet et facture.
 * Comme partout ailleurs : le navigateur ne fournit qu'un code d'offre, le
 * prix est relu en base et le résultat du paiement est redemandé à la banque.
 */

/** Ouvre une transaction pour une offre et renvoie la page de carte de la banque. */
export async function startPrepaidPayment(packCode: string): Promise<string> {
  const pack = await findPackByCode(packCode);
  if (pack.currency !== "TND") throw new ValidationError("Devise non prise en charge en ligne.");

  const row = await prisma.prepaidPayment.create({
    data: { packId: pack.id, amount: pack.price, currency: pack.currency },
  });
  const base = stripPublicPort(process.env.APP_URL ?? "https://levelupia.app");
  const { gatewayOrderId, formUrl } = await registerPayment({
    orderNumber: `LP${row.id}-${Date.now().toString(36)}`,
    amountMillimes: toMillimes(pack.price.toString()),
    returnUrl: `${base}${PAYMENT_RETURN_PATH}`,
    failUrl: `${base}${PAYMENT_FAIL_PATH}`,
    description: pack.name,
  });
  await prisma.prepaidPayment.update({ where: { id: row.id }, data: { gatewayOrderId } });
  return formUrl;
}

export type GatewayReturn = {
  outcome: GatewayOutcome;
  /** Paiement reçu sans compte client : à rattacher (cookie) puis inscription. */
  prepaid?: { id: string; packCode: string };
};

/**
 * Point d'entrée unique des URL de retour et de notification : la transaction
 * est soit celle d'une commande existante, soit un paiement avant inscription.
 */
export async function resolveGatewayReturn(gatewayOrderId: string): Promise<GatewayReturn> {
  const outcome = await finalizeGatewayPayment(gatewayOrderId);
  if (outcome !== "UNKNOWN") return { outcome };
  if (!/^[\w-]{8,64}$/.test(gatewayOrderId)) return { outcome };

  const row = await prisma.prepaidPayment.findUnique({ where: { gatewayOrderId }, include: { pack: true } });
  if (!row) return { outcome: "UNKNOWN" };
  if (row.status === "RATTACHEE") return { outcome: "PAID" };
  const prepaid = { id: row.id.toString(), packCode: row.pack.code };
  if (row.status === "PAYEE") return { outcome: "PAID", prepaid };

  const status = await fetchPaymentStatus(gatewayOrderId);
  if (!status.paid) return { outcome: status.declined ? "DECLINED" : "PENDING" };
  if (status.amountMillimes !== toMillimes(row.amount.toString()) || status.currency !== TND_NUMERIC) {
    console.error(`[paiement] montant inattendu pour le paiement ${row.id} : ${status.amountMillimes} ${status.currency}`);
    return { outcome: "UNKNOWN" };
  }

  const reference = status.approvalCode ? `${gatewayOrderId} / ${status.approvalCode}` : gatewayOrderId;
  // Un seul des appels concurrents (retour du client, notification) passe ici.
  const marked = await prisma.prepaidPayment.updateMany({
    where: { id: row.id, status: "EN_ATTENTE" },
    data: { status: "PAYEE", paymentReference: reference, paidAt: new Date() },
  });
  if (marked.count > 0) {
    notifyTeamByEmail(
      `Paiement accepté — ${row.pack.name}`,
      `Un visiteur a réglé ${Number(row.amount).toFixed(3)} TND par carte depuis le panier du site ` +
        `(paiement n° ${row.id}). Référence bancaire : ${reference}. ` +
        `La commande apparaîtra dans son espace dès qu'il aura créé son compte ou se sera connecté.`,
    );
  }
  return { outcome: "PAID", prepaid };
}

/**
 * Rattache un paiement reçu avant l'inscription au client qui vient de se
 * connecter : la commande est créée et aussitôt encaissée. Sans effet si le
 * paiement est déjà rattaché ou n'est pas réglé.
 */
export async function claimPrepaidPayment(clientId: bigint, prepaidId: string): Promise<boolean> {
  const id = BigInt(prepaidId);
  const taken = await prisma.prepaidPayment.updateMany({
    where: { id, status: "PAYEE" },
    data: { status: "RATTACHEE" },
  });
  if (taken.count === 0) return false;

  try {
    const row = await prisma.prepaidPayment.findUniqueOrThrow({ where: { id }, include: { pack: true } });
    const order = await createOrderForClient(clientId, row.pack.code, row.amount);
    await prisma.prepaidPayment.update({ where: { id }, data: { orderId: order.id } });
    await settleOrder(order.id, "EN_LIGNE", row.paymentReference ?? undefined, null);
    return true;
  } catch (e) {
    // Le paiement reste acquis : il pourra être rattaché à la prochaine connexion.
    await prisma.prepaidPayment.updateMany({ where: { id, status: "RATTACHEE", orderId: null }, data: { status: "PAYEE" } });
    console.error("[paiement] rattachement impossible:", e);
    return false;
  }
}
