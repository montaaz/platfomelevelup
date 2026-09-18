import { Prisma } from "@prisma/client";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { assertAdmin, clientScope, ForbiddenError, ValidationError, type Ctx } from "@/server/context";

/**
 * Commandes issues du site vitrine (levelupia.agency) vers la plateforme
 * (levelupia.app).
 *
 * Règle de sécurité centrale : le navigateur ne transmet JAMAIS un prix ni un
 * statut de paiement. Il transmet uniquement un CODE de pack, signé. Le prix
 * est relu dans la table `packs`, et le paiement ne peut être confirmé que
 * par un admin (ou, plus tard, par la passerelle bancaire côté serveur).
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
    const created = await tx.order.create({
      data: {
        clientId,
        packId: pack.id,
        amount: pack.price,           // prix serveur, jamais celui du navigateur
        currency: pack.currency,
        status: "EN_ATTENTE_PAIEMENT",
      },
    });
    // accès fermé jusqu'à confirmation du paiement
    await tx.client.update({
      where: { id: clientId },
      data: { accessGranted: false, accessGrantedAt: null },
    });
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
  const METHODS = ["VIREMENT", "CARTE", "ESPECES", "CHEQUE", "EN_LIGNE"] as const;
  if (!METHODS.includes(method as (typeof METHODS)[number])) {
    throw new ValidationError("Moyen de paiement inconnu.");
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, status: "EN_ATTENTE_PAIEMENT" },
    include: { pack: true, client: true },
  });
  if (!order) throw new ForbiddenError();

  await prisma.$transaction(async (tx) => {
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
    } else {
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
          createdByUserId: ctx.userId,
        },
      });
      await tx.projectStep.createMany({
        data: ["Brief reçu", "Production", "Première version", "Votre validation", "Livraison finale"].map(
          (label, i) => ({ projectId: project.id, label, position: i + 1, reachedAt: i === 0 ? new Date() : null }),
        ),
      });
      await tx.projectStatusHistory.create({
        data: {
          projectId: project.id,
          newStatus: "EN_ATTENTE",
          changedByUserId: ctx.userId,
          comment: `Créé automatiquement après paiement du ${order.pack.name}.`,
        },
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
        createdByUserId: ctx.userId,
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
        method: method as (typeof METHODS)[number],
        reference: reference?.trim() || null,
      },
    });

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "PAYEE",
        paymentMethod: method as (typeof METHODS)[number],
        paymentReference: reference?.trim() || null,
        paidAt: new Date(),
        confirmedBy: ctx.userId,
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
  });

  await prisma.auditLog.create({
    data: { userId: ctx.userId, action: "ORDER_PAID", entityType: "order", entityId: orderId },
  });
  return true;
}
