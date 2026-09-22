import { prisma } from "@/lib/prisma";
import { assertAdmin, type Ctx } from "@/server/context";
import { parseContext, type BuddyContext, type BuddyResult } from "./answer";
import type { Action } from "./templates";

/**
 * Historique des échanges avec l'assistant.
 *
 * Chaque question et chaque réponse sont conservées, rattachées au compte
 * et, pour un client, à sa fiche. Le client retrouve son fil en rouvrant le
 * widget — contexte de suivi compris — et l'équipe voit sur la fiche client
 * ce qui lui a été demandé. Un client ne lit jamais que ses propres
 * échanges ; un administrateur lit ceux d'un client depuis sa fiche.
 */

export type HistoryMessage = {
  id: string;
  role: "user" | "bot";
  text: string;
  kind: "answer" | "refusal" | "review" | null;
  actions: Action[] | null;
  createdAt: string;
};

const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 200;

/** Enregistre un aller-retour. Silencieux en cas d'échec : la réponse a déjà été donnée. */
export async function recordExchange(ctx: Ctx, question: string, result: BuddyResult): Promise<void> {
  try {
    const base = { userId: ctx.userId, clientId: ctx.clientId };
    await prisma.assistantMessage.createMany({
      data: [
        { ...base, role: "USER", body: question },
        {
          ...base,
          role: "ASSISTANT",
          body: result.text,
          kind: result.kind,
          intent: result.context?.intent ?? null,
          context: result.context ? (result.context as object) : undefined,
          actions: result.actions ? (result.actions as object[]) : undefined,
        },
      ],
    });
  } catch (e) {
    console.error("[buddy] historique non enregistré:", e);
  }
}

function toMessage(m: {
  id: bigint; role: string; body: string; kind: string | null; actions: unknown; createdAt: Date;
}): HistoryMessage {
  const actions = Array.isArray(m.actions)
    ? (m.actions as unknown[]).filter(
        (a): a is Action =>
          !!a && typeof a === "object" && typeof (a as Action).label === "string" &&
          typeof (a as Action).href === "string" && (a as Action).href.startsWith("/"),
      )
    : null;
  return {
    id: m.id.toString(),
    role: m.role === "USER" ? "user" : "bot",
    text: m.body,
    kind: m.kind === "answer" || m.kind === "refusal" || m.kind === "review" ? m.kind : null,
    actions: actions && actions.length ? actions : null,
    createdAt: m.createdAt.toISOString(),
  };
}

/** Le fil du compte connecté, du plus ancien au plus récent, et le dernier contexte de suivi. */
export async function myHistory(ctx: Ctx, limit = DEFAULT_LIMIT): Promise<{ messages: HistoryMessage[]; context?: BuddyContext }> {
  const rows = await prisma.assistantMessage.findMany({
    where: { userId: ctx.userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: Math.min(limit, MAX_LIMIT),
  });
  const last = rows.find((r) => r.role === "ASSISTANT" && r.context);
  return {
    messages: rows.reverse().map(toMessage),
    // Le contexte relu en base repasse par la même validation que celui du navigateur.
    context: last ? parseContext(last.context) : undefined,
  };
}

/** Efface le fil du compte connecté — et seulement le sien. */
export async function clearMyHistory(ctx: Ctx): Promise<number> {
  const { count } = await prisma.assistantMessage.deleteMany({ where: { userId: ctx.userId } });
  return count;
}

/** Fiche client : les échanges de tous les comptes de ce client. Administrateur seulement. */
export async function clientAssistantHistory(
  ctx: Ctx,
  clientId: bigint,
  limit = DEFAULT_LIMIT,
): Promise<(HistoryMessage & { userName: string })[]> {
  assertAdmin(ctx);
  const rows = await prisma.assistantMessage.findMany({
    where: { clientId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: Math.min(limit, MAX_LIMIT),
    include: { user: { select: { fullName: true } } },
  });
  return rows.reverse().map((r) => ({ ...toMessage(r), userName: r.user.fullName }));
}
