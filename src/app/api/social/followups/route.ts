import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { dueFollowups, markFollowedUp } from "@/server/services/socialBrain";

/** Relances des prospects chauds : GET = celles à envoyer aujourd'hui, POST = « envoyée ». Même jeton que /api/social/answer. */
function authorized(req: NextRequest): boolean {
  const expected = process.env.SOCIAL_WEBHOOK_TOKEN ?? "";
  const given = req.headers.get("x-social-token") ?? "";
  return expected.length >= 16 && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  try {
    return NextResponse.json({ followups: await dueFollowups() });
  } catch (e) {
    console.error("[social] relances:", e);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const parsed = z.object({ leadId: z.string().regex(/^\d{1,18}$/) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  try {
    await markFollowedUp(BigInt(parsed.data.leadId));
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[social] relance marquée impossible:", e);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
