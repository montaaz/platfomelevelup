import { NextResponse, type NextRequest } from "next/server";
import { authenticate, rateLimited } from "@/server/buddyAuth";
import { ForbiddenError, ValidationError } from "@/server/context";
import { executeAssistantAction, type ActionInput } from "@/server/services/assistantActions";
import { ALLOWED_ACTIONS } from "@/lib/assistantActions";

/**
 * Exécution d'une action confirmée par le client. Liste fermée, session
 * client obligatoire, `confirm: true` exigé : l'assistant ne décide jamais seul.
 */
export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  if (ctx.role !== "CLIENT") return NextResponse.json({ error: "Réservé aux clients." }, { status: 403 });
  if (rateLimited(ctx.userId.toString())) return NextResponse.json({ error: "Trop de demandes. Patientez une minute." }, { status: 429 });

  let body: { confirm?: unknown; action?: unknown; packCode?: unknown; title?: unknown; description?: unknown; projectId?: unknown; body?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  if (body.confirm !== true) return NextResponse.json({ error: "Confirmation requise." }, { status: 400 });
  const action = String(body.action ?? "");
  if (!(ALLOWED_ACTIONS as readonly string[]).includes(action)) return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
  const input: ActionInput = {
    action: action as ActionInput["action"], packCode: String(body.packCode ?? ""), title: String(body.title ?? ""), description: String(body.description ?? ""),
    projectId: String(body.projectId ?? ""), body: String(body.body ?? ""),
  };
  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  try {
    return NextResponse.json(await executeAssistantAction(ctx, input, { ip }));
  } catch (e) {
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
    console.error("[buddy action]", e);
    return NextResponse.json({ error: "Action impossible pour le moment." }, { status: 500 });
  }
}
