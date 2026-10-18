import { prisma } from "@/lib/prisma";
import { clientScope, ForbiddenError, ValidationError, type Ctx } from "@/server/context";
import { ensurePendingOrder, findPackByCode } from "@/server/services/orders";
import { createProjectRequest } from "@/server/services/clientActions";
import { sendMessage } from "@/server/services/messaging";
import { formatDT } from "@/lib/format";
import { ALLOWED_ACTIONS, type AllowedAction } from "@/lib/assistantActions";

/**
 * Exécution d'une action confirmée par le client, via l'assistant (texte ou appel).
 *
 * Garde-fous :
 *  - uniquement un compte CLIENT, avec sa propre session : les services appelés
 *    sont ceux de l'espace client (même périmètre, mêmes droits) ;
 *  - liste fermée d'actions (ALLOWED_ACTIONS) ; tout le reste est refusé ;
 *  - rien qui relève de l'équipe : aucune validation de paiement, aucun statut,
 *    aucune suppression, aucun prix ;
 *  - chaque exécution est journalisée (security_events) et signalée aux admins.
 */
export type ActionInput = { action: AllowedAction; packCode?: string; title?: string; description?: string; projectId?: string; body?: string };

export async function executeAssistantAction(ctx: Ctx, input: ActionInput, meta: { ip: string | null }): Promise<{ text: string; href: string }> {
  if (ctx.role !== "CLIENT") throw new ForbiddenError();
  if (!(ALLOWED_ACTIONS as readonly string[]).includes(input.action)) throw new ForbiddenError();
  const clientId = clientScope(ctx);
  const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId }, select: { companyName: true } });

  let text: string;
  let href: string;
  let summary: string;

  switch (input.action) {
    case "ADD_TO_CART": {
      const code = String(input.packCode ?? "");
      if (!/^[A-Z0-9_]{2,40}$/.test(code)) throw new ValidationError("Offre inconnue.");
      const pack = await findPackByCode(code);
      const order = await ensurePendingOrder(clientId, pack.code);
      const price = `${formatDT(Number(pack.price))}${pack.isMonthly ? " / mois" : ""}`;
      text = `✓ ${pack.name} (${price}) est dans vos commandes, en attente de paiement. Réglez-la quand vous voulez depuis « Régler ma commande » : votre prestation démarre dès que l'équipe confirme le règlement.`;
      href = `/paiement?commande=${order.id.toString()}`;
      summary = `${pack.name} ajouté aux commandes (n° ${order.id})`;
      break;
    }
    case "CREATE_REQUEST": {
      const title = String(input.title ?? "").trim().slice(0, 200);
      const description = String(input.description ?? "").trim().slice(0, 4000);
      if (title.length < 3) throw new ValidationError("Décrivez votre demande en quelques mots.");
      await createProjectRequest(ctx, { title, description });
      text = `✓ Votre demande « ${title} » est envoyée à l'équipe Level Up AI, qui vous répond avec une proposition.`;
      href = "/client";
      summary = `demande de projet « ${title} »`;
      break;
    }
    case "SEND_MESSAGE": {
      const projectId = String(input.projectId ?? "");
      const body = String(input.body ?? "").trim().slice(0, 5000);
      if (!/^\d{1,18}$/.test(projectId)) throw new ValidationError("Projet inconnu.");
      if (body.length < 2) throw new ValidationError("Message vide.");
      await sendMessage(ctx, BigInt(projectId), body); // vérifie que le projet appartient bien au client
      text = "✓ Message envoyé à l'équipe sur votre projet. Elle vous répond dans la messagerie.";
      href = "/client/messages";
      summary = `message à l'équipe (projet ${projectId})`;
      break;
    }
    default:
      throw new ForbiddenError();
  }

  // Journal + information de l'équipe : toute action de l'assistant est visible.
  await prisma.securityEvent.create({
    data: { clientId, userId: ctx.userId, kind: "ASSISTANT_ACTION", severity: "info", reason: `${input.action} — ${summary}`, ip: meta.ip?.slice(0, 64) ?? null },
  });
  if (input.action === "ADD_TO_CART") {
    const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });
    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((a) => ({ userId: a.id, type: "DEMANDE_PROJET" as const, title: `Commande via l'assistant — ${client.companyName}`, body: summary, entityType: "order" })),
      });
    }
  }
  return { text, href };
}
