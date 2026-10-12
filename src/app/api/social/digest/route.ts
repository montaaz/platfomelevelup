import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { dailyDigest } from "@/server/services/socialBrain";

/** Bilan des dernières 24 h pour n8n (e-mail du soir à l'équipe). Même jeton que /api/social/answer. */
function authorized(req: NextRequest): boolean {
  const expected = process.env.SOCIAL_WEBHOOK_TOKEN ?? "";
  const given = req.headers.get("x-social-token") ?? "";
  return expected.length >= 16 && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  try {
    return NextResponse.json(await dailyDigest());
  } catch (e) {
    console.error("[social] bilan impossible:", e);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
