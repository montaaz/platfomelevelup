import path from "node:path";
import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { mirrorNotificationEmails, notifyTeamByEmail } from "@/lib/mail";
import { transferLabel } from "@/lib/bank";
import { assertAdmin, clientScope, ForbiddenError, ValidationError, type Ctx } from "@/server/context";
import { settleOrder } from "@/server/services/orders";

/**
 * Paiement par virement : le client dépose un justificatif, l'équipe le
 * vérifie sur le compte bancaire puis valide ou refuse.
 *
 *   dépôt (client)  →  EN_ATTENTE  →  ACCEPTE : commande PAYEE (settleOrder)
 *                                  →  REFUSE  : motif au client, nouveau dépôt possible
 *
 * Le justificatif est stocké hors du dossier public et servi par une route
 * qui vérifie la session (admin, ou le client propriétaire).
 */

const STORAGE_ROOT = path.join(process.cwd(), "storage", "uploads");
const MAX_SIZE = 10 * 1024 * 1024; // 10 Mo
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export type ProofRow = {
  id: string;
  status: string;
  reference: string | null;
  originalName: string;
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

const toRow = (p: {
  id: bigint; status: string; reference: string | null; originalName: string;
  reviewNote: string | null; createdAt: Date; reviewedAt: Date | null;
}): ProofRow => ({
  id: p.id.toString(),
  status: p.status,
  reference: p.reference,
  originalName: p.originalName,
  reviewNote: p.reviewNote,
  createdAt: p.createdAt.toISOString(),
  reviewedAt: p.reviewedAt?.toISOString() ?? null,
});

/** Dernier justificatif de chaque commande donnée (le plus récent compte). */
export async function latestProofsByOrder(orderIds: bigint[]): Promise<Map<string, ProofRow>> {
  if (orderIds.length === 0) return new Map();
  const rows = await prisma.paymentProof.findMany({
    where: { orderId: { in: orderIds } },
    orderBy: { createdAt: "desc" },
  });
  const map = new Map<string, ProofRow>();
  for (const r of rows) {
    const key = r.orderId.toString();
    if (!map.has(key)) map.set(key, toRow(r));
  }
  return map;
}

/** Le client dépose le justificatif de son virement pour une commande en attente. */
export async function submitTransferProof(
  ctx: Ctx,
  orderId: bigint,
  file: File,
  reference: string | null,
) {
  const clientId = clientScope(ctx);
  const order = await prisma.order.findFirst({
    where: { id: orderId, clientId, status: "EN_ATTENTE_PAIEMENT" },
    include: { pack: true, client: { select: { companyName: true } } },
  });
  if (!order) throw new ValidationError("Cette commande n'attend plus de paiement.");

  if (!file || file.size === 0 || file.size > MAX_SIZE) {
    throw new ValidationError("Fichier vide ou supérieur à 10 Mo.");
  }
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_MIME.has(mime)) throw new ValidationError("Format accepté : PDF, JPG, PNG ou WebP.");

  // Un justificatif déjà en cours de vérification suffit : pas de doublon.
  const pending = await prisma.paymentProof.findFirst({ where: { orderId, status: "EN_ATTENTE" } });
  if (pending) throw new ValidationError("Votre justificatif est déjà en cours de vérification.");

  const originalName = path.basename(file.name).slice(0, 255) || "justificatif";
  const storageKey = `transfers/${orderId}/${crypto.randomUUID()}${path.extname(originalName).slice(0, 12)}`;
  const filePath = path.join(STORAGE_ROOT, storageKey);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, Buffer.from(await file.arrayBuffer()));

  const proof = await prisma.paymentProof.create({
    data: {
      orderId,
      clientId,
      uploadedByUserId: ctx.userId,
      originalName,
      storageKey,
      mimeType: mime,
      sizeBytes: BigInt(file.size),
      reference: reference?.trim().slice(0, 160) || null,
    },
  });
  // La commande est désormais engagée par virement.
  await prisma.order.update({ where: { id: orderId }, data: { paymentMethod: "VIREMENT" } });

  const amount = `${Number(order.amount).toFixed(3)} TND`;
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });
  if (admins.length > 0) {
    const title = `Virement à vérifier — ${order.client.companyName}`;
    const body = `${order.pack.name} · ${amount} · libellé attendu ${transferLabel(orderId)}.`;
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        type: "DEMANDE_PROJET" as const,
        title,
        body,
        entityType: "order",
        entityId: orderId,
      })),
    });
    mirrorNotificationEmails(admins.map((a) => a.id), title, body);
  }
  notifyTeamByEmail(
    `Justificatif de virement reçu — ${order.client.companyName}`,
    `${order.pack.name} · ${amount}. Libellé attendu : ${transferLabel(orderId)}` +
      (proof.reference ? ` · référence indiquée : ${proof.reference}` : "") +
      `. À vérifier sur le compte puis à valider dans Commandes.`,
  );
  return toRow(proof);
}

/** Fichier d'un justificatif, pour la route de téléchargement (admin ou client propriétaire). */
export async function proofFileFor(ctx: Ctx, proofId: bigint) {
  const proof = await prisma.paymentProof.findFirst({
    where: { id: proofId, ...(ctx.role === "CLIENT" ? { clientId: clientScope(ctx) } : {}) },
  });
  if (!proof) throw new ForbiddenError();
  const filePath = path.resolve(STORAGE_ROOT, proof.storageKey);
  if (!filePath.startsWith(STORAGE_ROOT + path.sep)) throw new ForbiddenError();
  return { filePath, mimeType: proof.mimeType, originalName: proof.originalName };
}

/**
 * L'équipe a vérifié le compte : elle valide (la commande est encaissée,
 * exactement comme un paiement par carte) ou refuse avec un motif.
 */
export async function reviewTransferProof(ctx: Ctx, proofId: bigint, accept: boolean, note?: string | null) {
  assertAdmin(ctx);
  const proof = await prisma.paymentProof.findFirst({
    where: { id: proofId, status: "EN_ATTENTE" },
    include: { order: { include: { pack: true } } },
  });
  if (!proof) throw new ForbiddenError();
  const cleanNote = note?.trim() || null;
  if (!accept && !cleanNote) throw new ValidationError("Indiquez au client pourquoi le justificatif est refusé.");

  await prisma.paymentProof.update({
    where: { id: proofId },
    data: { status: accept ? "ACCEPTE" : "REFUSE", reviewNote: cleanNote, reviewedByUserId: ctx.userId, reviewedAt: new Date() },
  });

  if (accept) {
    const reference = proof.reference ? `Virement ${proof.reference}` : `Virement ${transferLabel(proof.orderId)}`;
    const settled = await settleOrder(proof.orderId, "VIREMENT", reference, ctx.userId);
    if (!settled) throw new ValidationError("Cette commande a déjà été encaissée.");
    return true;
  }

  const clientUsers = await prisma.user.findMany({
    where: { role: "CLIENT", clientId: proof.clientId, isActive: true },
    select: { id: true },
  });
  if (clientUsers.length > 0) {
    const title = `Justificatif de virement refusé — ${proof.order.pack.name}`;
    const body = `${cleanNote} Vous pouvez déposer un nouveau justificatif depuis votre espace.`;
    await prisma.notification.createMany({
      data: clientUsers.map((u) => ({
        userId: u.id,
        type: "STATUT_PROJET" as const,
        title,
        body,
        entityType: "order",
        entityId: proof.orderId,
      })),
    });
    mirrorNotificationEmails(clientUsers.map((u) => u.id), title, body);
  }
  return true;
}
