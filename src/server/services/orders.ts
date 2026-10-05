import { Prisma } from "@prisma/client";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { assertAdmin, clientScope, ForbiddenError, ValidationError, type Ctx } from "@/server/context";
import { fetchPaymentStatus, registerPayment, toMillimes, TND_NUMERIC } from "@/lib/clictopay";
import { notifyTeamByEmail } from "@/lib/mail";
import { stripPublicPort } from "@/lib/publicUrl";

/**
 * Commandes issues du site vitrine (levelupia.agency) vers la plateforme
 * (levelupia.app).
 *
 * Règle de sécurité centrale : le navigateur ne transmet JAMAIS un prix ni un
 * statut de paiement. Il transmet uniquement un CODE de pack, signé. Le prix
 * est relu dans la table `packs`, et le paiement ne peut être confirmé que
 * par un admin ou par la passerelle bancaire, interrogée côté serveur.
 */

const TOKEN_TTL_MIN = 60;

function secret() {
  const s = process.env.CART_TOKEN_SECRET || process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("CART_TOKEN_SECRET/AUTH_SECRET manquant ou trop court");
  return new TextEncoder().encode(s);
}

/** Jeton signé émis par le site vitrine : ne contient que le code du pack. */
export async function signCartToken(packCode: string): Promise<string> {
  return new SignJWT({ pack: packCode })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("levelupia.agency")
    .setAudience("levelupia.app")
    .setExpirationTime(`${TOKEN_TTL_MIN}m`)
    .sign(secret());
}

/** Vérifie le jeton et renvoie le pack correspondant (prix relu en base). */
export async function readCartToken(token: string) {
  let packCode: string;
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: "levelupia.agency",
      audience: "levelupia.app",
    });
    packCode = typeof payload.pack === "string" ? payload.pack : "";
  } catch {
    throw new ValidationError("Lien de commande invalide ou expiré.");
  }
  if (!packCode) throw new ValidationError("Lien de commande incomplet.");

  const pack = await prisma.pack.findFirst({ where: { code: packCode, isActive: true } });
  if (!pack) throw new ValidationError("Cette offre n'est plus disponible.");
  return pack;
}

/** Retrouve une offre par son code (paramètre ?pack= du site vitrine). */
export async function findPackByCode(code: string) {
  const pack = await prisma.pack.findFirst({ where: { code, isActive: true } });
  if (!pack) throw new ValidationError("Cette offre n'est plus disponible.");
  return pack;
}

export async function listPacks() {
  const packs = await prisma.pack.findMany({ where: { isActive: true }, orderBy: { position: "asc" } });
  return packs.map((p) => ({
    id: p.id.toString(),
    code: p.code,
    name: p.name,
    description: p.description,
    price: Number(p.price),
    isMonthly: p.isMonthly,
  }));
}

/**
 * Crée la commande d'un client après son inscription.
 * L'accès à la plateforme reste fermé tant que le paiement n'est pas confirmé.
 */
export async function createOrderForClient(clientId: bigint, packCode: string) {
  const pack = await prisma.pack.findFirst({ where: { code: packCode, isActive: true } });
  if (!pack) throw new ValidationError("Cette offre n'est plus disponible.");

  const order = await prisma.$transaction(async (tx) => {
    // Le projet existe dès la commande : le client le voit dans « Mes projets »
    // et peut échanger avec l'équipe sans attendre le règlement. Un abonnement
    // mensuel n'a pas de projet : il devient un abonnement une fois payé.
    let projectId: bigint | null = null;
    if (!pack.isMonthly) {
      const serviceId =
        pack.serviceId ??
        (await tx.service.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } })).id;
      const project = await tx.project.create({
        data: {
          clientId,
          serviceId,
          title: pack.name,
          description: pack.description,
          price: pack.price,
          status: "EN_ATTENTE_PAIEMENT",
          startDate: new Date(),
        },
      });
      await tx.projectStep.createMany({
        data: ["Brief reçu", "Production", "Première version", "Votre validation", "Livraison finale"].map(
          (label, i) => ({ projectId: project.id, label, position: i + 1 }),
        ),
      });
      await tx.projectStatusHistory.create({
        data: {
          projectId: project.id,
          newStatus: "EN_ATTENTE_PAIEMENT",
          comment: `Commande du ${pack.name} depuis le site vitrine.`,
        },
      });

      // Message d'accueil de l'équipe : le fil existe dès maintenant, donc le
      // client peut répondre tout de suite (la liste des conversations
      // n'affiche que les projets ayant au moins un message).
      const teamUser = await tx.user.findFirst({
        where: { role: "ADMIN", isActive: true },
        orderBy: { id: "asc" },
        select: { id: true },
      });
      if (teamUser) {
        await tx.message.create({
          data: {
            projectId: project.id,
            senderUserId: teamUser.id,
            body:
              `Bonjour et bienvenue ! Nous avons bien reçu votre commande du ${pack.name}. ` +
              `Votre projet est ouvert : dès que le règlement est confirmé, nous démarrons la production. ` +
              `En attendant, décrivez-nous votre besoin ici — nous vous répondons rapidement.`,
          },
        });
      }
      projectId = project.id;
    }

    const created = await tx.order.create({
      data: {
        clientId,
        packId: pack.id,
        amount: pack.price,           // prix serveur, jamais celui du navigateur
        currency: pack.currency,
        status: "EN_ATTENTE_PAIEMENT",
        projectId,
      },
    });
    // L'accès reste ouvert : le client entre tout de suite et suit l'état de
    // son paiement depuis son espace.
    return created;
  });

  const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });
  if (admins.length > 0) {
    const client = await prisma.client.findUnique({ where: { id: clientId }, select: { companyName: true } });
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        type: "DEMANDE_PROJET" as const,
        title: `Commande à encaisser — ${pack.name}`,
        body: `${client?.companyName ?? "Un client"} attend la confirmation du paiement (${Number(pack.price).toFixed(0)} TND).`,
        entityType: "order",
        entityId: order.id,
      })),
    });
  }
  return order;
}


/**
 * Commandes du client connecté qui attendent encore leur règlement, de la
 * plus récente à la plus ancienne : chacune porte un bouton « Payer ».
 */
export async function myPendingOrders(ctx: Ctx) {
  const clientId = clientScope(ctx);
  const orders = await prisma.order.findMany({
    where: { clientId, status: "EN_ATTENTE_PAIEMENT" },
    orderBy: { createdAt: "desc" },
    include: { pack: true },
  });
  return orders.map((o) => ({
    id: o.id.toString(),
    projectId: o.projectId?.toString() ?? null,
    packName: o.pack.name,
    amount: Number(o.amount),
    isMonthly: o.pack.isMonthly,
  }));
}

/** État d'accès du client connecté : sert à bloquer l'espace client. */
export async function myAccessState(ctx: Ctx) {
  const clientId = clientScope(ctx);
  const client = await prisma.client.findUniqueOrThrow({
    where: { id: clientId },
    select: { accessGranted: true, companyName: true },
  });
  const pending = await prisma.order.findFirst({
    where: { clientId, status: "EN_ATTENTE_PAIEMENT" },
    orderBy: { createdAt: "desc" },
    include: { pack: true },
  });
  return {
    accessGranted: client.accessGranted,
    companyName: client.companyName,
    pendingOrder: pending
      ? {
          id: pending.id.toString(),
          packName: pending.pack.name,
          amount: Number(pending.amount),
          isMonthly: pending.pack.isMonthly,
          createdAt: pending.createdAt.toISOString(),
        }
      : null,
  };
}

/* ------------------------------------------------------------------ admin */

export type OrderRow = {
  id: string;
  clientId: string;
  clientCompany: string;
  packName: string;
  isMonthly: boolean;
  amount: number;
  status: string;
  paidAt: string | null;
  createdAt: string;
};

export async function listOrders(ctx: Ctx): Promise<OrderRow[]> {
  assertAdmin(ctx);
  const orders = await prisma.order.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { client: true, pack: true },
  });
  return orders.map((o) => ({
    id: o.id.toString(),
    clientId: o.clientId.toString(),
    clientCompany: o.client.companyName,
    packName: o.pack.name,
    isMonthly: o.pack.isMonthly,
    amount: Number(o.amount),
    status: o.status,
    paidAt: o.paidAt?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
  }));
}

/**
 * L'admin confirme le paiement : la commande devient PAYEE, l'accès s'ouvre,
 * et le pack se matérialise en projet (ou abonnement) + facture payée.
 */
export async function confirmOrderPayment(
  ctx: Ctx,
  orderId: bigint,
  method: string,
  reference?: string,
) {
  assertAdmin(ctx);
  if (!METHODS.includes(method as PaymentMethodName)) {
    throw new ValidationError("Moyen de paiement inconnu.");
  }
  if (!(await settleOrder(orderId, method as PaymentMethodName, reference, ctx.userId))) {
    throw new ForbiddenError();
  }
  return true;
}

const METHODS = ["VIREMENT", "CARTE", "ESPECES", "CHEQUE", "EN_LIGNE"] as const;
type PaymentMethodName = (typeof METHODS)[number];

/**
 * Encaisse une commande : c'est le seul endroit où elle devient PAYEE, que la
 * confirmation vienne d'un admin (`actorUserId`) ou de la banque (null).
 * Renvoie false si la commande n'était plus en attente — déjà réglée, par
 * exemple quand le retour du client et la notification de la banque arrivent
 * en même temps.
 */
async function settleOrder(
  orderId: bigint,
  method: PaymentMethodName,
  reference: string | undefined,
  actorUserId: bigint | null,
): Promise<boolean> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, status: "EN_ATTENTE_PAIEMENT" },
    include: { pack: true, client: true },
  });
  if (!order) return false;

  const settled = await prisma.$transaction(async (tx) => {
    // Prise de la commande : un seul appel concurrent passe, l'autre s'arrête
    // ici sans créer une seconde facture.
    const claim = await tx.order.updateMany({
      where: { id: order.id, status: "EN_ATTENTE_PAIEMENT" },
      data: { status: "PAYEE" },
    });
    if (claim.count === 0) return false;

    let projectId: bigint | null = null;
    let subscriptionId: bigint | null = null;

    if (order.pack.isMonthly) {
      const now = new Date();
      const renewal = new Date(now);
      renewal.setMonth(renewal.getMonth() + 1);
      const sub = await tx.subscription.create({
        data: {
          clientId: order.clientId,
          planName: order.pack.name,
          monthlyAmount: order.amount,
          status: "ACTIF",
          startDate: now,
          renewalDate: renewal,
        },
      });
      subscriptionId = sub.id;
    } else if (order.projectId) {
      // Le projet a été créé à la commande : le paiement l'active simplement.
      await tx.project.update({
        where: { id: order.projectId },
        data: { status: "EN_ATTENTE" },
      });
      await tx.projectStep.updateMany({
        where: { projectId: order.projectId, position: 1, reachedAt: null },
        data: { reachedAt: new Date() },
      });
      await tx.projectStatusHistory.create({
        data: {
          projectId: order.projectId,
          oldStatus: "EN_ATTENTE_PAIEMENT",
          newStatus: "EN_ATTENTE",
          changedByUserId: actorUserId,
          comment: `Paiement confirmé : la prestation démarre.`,
        },
      });
      projectId = order.projectId;
    } else {
      // Sécurité : commande ancienne sans projet rattaché — on le crée.
      const serviceId =
        order.pack.serviceId ??
        (await tx.service.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } })).id;
      const project = await tx.project.create({
        data: {
          clientId: order.clientId,
          serviceId,
          title: order.pack.name,
          description: order.pack.description,
          price: order.amount,
          status: "EN_ATTENTE",
          startDate: new Date(),
          createdByUserId: actorUserId,
        },
      });
      await tx.projectStep.createMany({
        data: ["Brief reçu", "Production", "Première version", "Votre validation", "Livraison finale"].map(
          (label, i) => ({ projectId: project.id, label, position: i + 1, reachedAt: i === 0 ? new Date() : null }),
        ),
      });
      projectId = project.id;
    }

    // facture payée, numérotée par la fonction SQL séquentielle
    const year = new Date().getFullYear();
    const rows = await tx.$queryRaw<{ n: string }[]>`SELECT next_invoice_number(${year}::smallint) AS n`;
    const subtotal = Number(order.amount) / 1.19;
    const vat = Number(order.amount) - subtotal;
    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber: rows[0]!.n,
        clientId: order.clientId,
        projectId,
        status: "PAYEE",
        subtotal: new Prisma.Decimal(subtotal.toFixed(3)),
        vatRate: new Prisma.Decimal(19),
        vatAmount: new Prisma.Decimal(vat.toFixed(3)),
        total: order.amount,
        paidAt: new Date(),
        createdByUserId: actorUserId,
        lines: {
          create: [{
            description: order.pack.name,
            quantity: 1,
            unitPrice: new Prisma.Decimal(subtotal.toFixed(3)),
            lineTotal: new Prisma.Decimal(subtotal.toFixed(3)),
          }],
        },
      },
    });
    await tx.payment.create({
      data: {
        invoiceId: invoice.id,
        amount: order.amount,
        method,
        reference: reference?.trim() || null,
      },
    });

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "PAYEE",
        paymentMethod: method,
        paymentReference: reference?.trim() || null,
        paidAt: new Date(),
        confirmedBy: actorUserId,
        projectId,
        subscriptionId,
        invoiceId: invoice.id,
      },
    });

    // l'accès s'ouvre enfin
    await tx.client.update({
      where: { id: order.clientId },
      data: { accessGranted: true, accessGrantedAt: new Date() },
    });

    const clientUsers = await tx.user.findMany({
      where: { role: "CLIENT", clientId: order.clientId, isActive: true },
      select: { id: true },
    });
    if (clientUsers.length > 0) {
      await tx.notification.createMany({
        data: clientUsers.map((u) => ({
          userId: u.id,
          type: "STATUT_PROJET" as const,
          title: `Paiement confirmé — ${order.pack.name}`,
          body: "Votre accès est ouvert : retrouvez votre commande dans votre espace.",
          entityType: "client",
          entityId: order.clientId,
        })),
      });
    }
    return true;
  });
  if (!settled) return false;

  await prisma.auditLog.create({
    data: { userId: actorUserId, action: "ORDER_PAID", entityType: "order", entityId: orderId },
  });
  return true;
}

/* ------------------------------------------------- paiement en ligne (banque) */

/** Chemins publics déclarés à la banque (fiche technique Attijari E-Payment). */
export const PAYMENT_RETURN_PATH = "/api/paiement/retour";
export const PAYMENT_FAIL_PATH = "/api/paiement/echec";

/**
 * Ouvre une transaction ClicToPay pour une commande en attente du client
 * connecté (la plus récente si aucune n'est désignée) et renvoie la page de
 * saisie de carte de la banque. Le navigateur ne désigne que la commande : son
 * appartenance au client est vérifiée ici et son montant relu en base.
 */
export async function startOnlinePayment(ctx: Ctx, orderId?: bigint): Promise<string> {
  const clientId = clientScope(ctx);
  const order = await prisma.order.findFirst({
    where: { clientId, status: "EN_ATTENTE_PAIEMENT", ...(orderId != null ? { id: orderId } : {}) },
    orderBy: { createdAt: "desc" },
    include: { pack: true },
  });
  if (!order) throw new ValidationError("Aucune commande en attente de paiement.");
  if (order.currency !== "TND") throw new ValidationError("Devise non prise en charge en ligne.");

  // La carte a peut-être déjà été débitée lors d'une tentative précédente dont
  // le retour s'est perdu : on le vérifie avant d'en ouvrir une nouvelle.
  if (order.gatewayOrderId && (await finalizeGatewayPayment(order.gatewayOrderId)) === "PAID") {
    throw new ValidationError("Cette commande est déjà réglée.");
  }

  const base = stripPublicPort(process.env.APP_URL ?? "https://levelupia.app");
  const { gatewayOrderId, formUrl } = await registerPayment({
    // unique chez la banque : chaque tentative porte son propre numéro
    orderNumber: `LU${order.id}-${Date.now().toString(36)}`,
    amountMillimes: toMillimes(order.amount.toString()),
    returnUrl: `${base}${PAYMENT_RETURN_PATH}`,
    failUrl: `${base}${PAYMENT_FAIL_PATH}`,
    description: order.pack.name,
  });
  await prisma.order.update({ where: { id: order.id }, data: { gatewayOrderId } });
  return formUrl;
}

export type GatewayOutcome = "PAID" | "DECLINED" | "PENDING" | "UNKNOWN";

/**
 * Relit auprès de la banque le résultat d'une transaction et, si la carte a
 * été débitée du bon montant, encaisse la commande. Appelée au retour du
 * client ET par la notification de la banque : elle est sans effet la
 * deuxième fois. L'identifiant vient d'une URL publique, donc rien d'autre
 * que la réponse de la banque n'est pris en compte.
 */
export async function finalizeGatewayPayment(gatewayOrderId: string): Promise<GatewayOutcome> {
  if (!/^[\w-]{8,64}$/.test(gatewayOrderId)) return "UNKNOWN";
  const order = await prisma.order.findUnique({
    where: { gatewayOrderId },
    include: { pack: true, client: true },
  });
  if (!order) return "UNKNOWN";
  if (order.status === "PAYEE") return "PAID";
  if (order.status !== "EN_ATTENTE_PAIEMENT") return "DECLINED";

  const status = await fetchPaymentStatus(gatewayOrderId);
  if (!status.paid) return status.declined ? "DECLINED" : "PENDING";

  if (status.amountMillimes !== toMillimes(order.amount.toString()) || status.currency !== TND_NUMERIC) {
    console.error(
      `[paiement] montant inattendu pour la commande ${order.id} : ${status.amountMillimes} ${status.currency}`,
    );
    return "UNKNOWN";
  }

  const reference = status.approvalCode ? `${gatewayOrderId} / ${status.approvalCode}` : gatewayOrderId;
  if (await settleOrder(order.id, "EN_LIGNE", reference, null)) {
    const amount = `${Number(order.amount).toFixed(3)} TND`;
    const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });
    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          type: "DEMANDE_PROJET" as const,
          title: `Paiement en ligne reçu — ${order.pack.name}`,
          body: `${order.client.companyName} a réglé ${amount} par carte.`,
          entityType: "order",
          entityId: order.id,
        })),
      });
    }
    notifyTeamByEmail(
      `Paiement accepté — ${order.pack.name}`,
      `${order.client.companyName} a réglé ${amount} par carte bancaire (commande n° ${order.id}). ` +
        `Référence bancaire : ${reference}. L'accès du client, sa facture et son projet sont à jour.`,
    );
  }
  return "PAID";
}
