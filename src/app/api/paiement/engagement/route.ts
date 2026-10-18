import { NextResponse, type NextRequest } from "next/server";
import { ctxOrNull, ValidationError } from "@/server/context";
import { setOrderCommitment } from "@/server/services/orders";

/** Durée d'engagement d'un abonnement (1, 6 ou 12 mois) avant paiement. */
export async function POST(req: NextRequest) {
  const ctx = await ctxOrNull("CLIENT");
  if (!ctx) return NextResponse.json({ error: "Session expirée." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { orderId?: unknown; months?: unknown } | null;
  const orderId = typeof body?.orderId === "string" && /^\d{1,18}$/.test(body.orderId) ? BigInt(body.orderId) : null;
  const months = Number(body?.months);
  if (!orderId || ![1, 6, 12].includes(months)) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  try {
    return NextResponse.json(await setOrderCommitment(ctx, orderId, months));
  } catch (e) {
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[engagement]", e);
    return NextResponse.json({ error: "Modification impossible." }, { status: 500 });
  }
}
