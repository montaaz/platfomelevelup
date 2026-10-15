import type { Ctx } from "@/server/context";
import { answerBuddy, parseContext, type BuddyResult } from "@/buddy/answer";
import { prismaDataSource } from "@/buddy/data/prisma";
import { configuredModel } from "@/buddy/ai/model";
import { recordExchange } from "@/buddy/history";
import { adminOnlyMessage, detectProposal, proposalPrompt, type Proposal } from "@/lib/assistantActions";

export type ChatReply = BuddyResult & {
  /** Action proposée au client ; exécutée seulement après son « Confirmer ». */
  proposal?: Proposal;
};

/**
 * Un tour de conversation de l'assistant (texte ou appel) : la réponse
 * habituelle (gabarits + modèle Baarcha sur les données du compte), plus,
 * pour un client, l'action qu'il semble demander — proposée, jamais faite.
 */
export async function buddyTurn(ctx: Ctx, message: string, rawContext: unknown): Promise<ChatReply> {
  const result = await answerBuddy(ctx, message, prismaDataSource, parseContext(rawContext), new Date(), undefined, configuredModel());
  let reply: ChatReply = result;

  if (ctx.role === "CLIENT") {
    const [products, projects] = await Promise.all([
      prismaDataSource.products(),
      prismaDataSource.projects(ctx, { limit: 20 }),
    ]);
    const detected = detectProposal(
      message,
      products.map((p) => ({ code: p.code, name: p.name, price: p.price, isMonthly: p.isMonthly, position: p.position })),
      projects.map((p) => ({ id: p.id, title: p.title })),
    );
    if (detected?.kind === "proposal") {
      reply = { ...result, kind: "answer", text: proposalPrompt(detected.proposal, result.lang), proposal: detected.proposal, suggestions: undefined, actions: undefined };
    } else if (detected?.kind === "admin-only") {
      reply = {
        ...result,
        kind: "answer",
        text: adminOnlyMessage(result.lang),
        proposal: { action: "CREATE_REQUEST", title: message.slice(0, 80), description: message, label: "Transmettre à l'équipe", summary: "Votre demande sera transmise à l'équipe Level Up IA." },
        suggestions: undefined,
        actions: undefined,
      };
    }
  }
  await recordExchange(ctx, message, reply);
  return reply;
}
