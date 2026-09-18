import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { signCartToken, listPacks } from "@/server/services/orders";
import { ValidationError } from "@/server/context";

/** Seul le site vitrine peut demander un jeton de commande. */
const ALLOWED_ORIGINS = (process.env.VITRINE_ORIGINS ?? "https://levelupia.agency")
  .split(",").map((o) => o.trim()).filter(Boolean);

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]!;
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

/** Catalogue public : le site vitrine peut afficher les prix officiels. */
export async function GET(req: NextRequest) {
  return NextResponse.json({ packs: await listPacks() }, { headers: corsHeaders(req.headers.get("origin")) });
}

/**
 * Le site vitrine envoie un CODE de pack ; on renvoie un jeton signé et
 * l'URL d'inscription. Aucun prix ne transite par le navigateur.
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return NextResponse.json({ error: "Origine non autorisée." }, { status: 403, headers });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400, headers });
  }

  const parsed = z.object({ packCode: z.string().min(2).max(40) }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Code d'offre manquant." }, { status: 400, headers });
  }

  try {
    const packs = await listPacks();
    const pack = packs.find((p) => p.code === parsed.data.packCode);
    if (!pack) return NextResponse.json({ error: "Offre inconnue." }, { status: 404, headers });

    const token = await signCartToken(pack.code);
    const base = process.env.APP_URL?.replace(/\/+$/, "") ?? "https://levelupia.app";
    return NextResponse.json(
      { token, pack, signupUrl: `${base}/inscription?cart=${encodeURIComponent(token)}` },
      { headers },
    );
  } catch (e) {
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400, headers });
    }
    console.error("[cart]", e);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500, headers });
  }
}
