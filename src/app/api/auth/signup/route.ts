import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { signupClient } from "@/server/services/signup";
import { createSession } from "@/lib/session";
import { recordDetectedCountry } from "@/server/services/geo";
import { ValidationError } from "@/server/context";
import { readCartToken, findPackByCode, createOrderForClient } from "@/server/services/orders";

const SignupInput = z.object({
  fullName: z.string().min(1).max(160),
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
  confirmPassword: z.string().min(1).max(200),
  // jeton signé émis par le site vitrine (facultatif : inscription directe possible)
  cartToken: z.string().max(2000).optional(),
  // code d'offre transmis par le site vitrine (?pack=)
  packCode: z.string().max(40).optional(),
});

/** Anti-abus : au plus 5 inscriptions par IP et par heure (mémoire du process). */
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const attempts = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    attempts.set(ip, recent);
    return true;
  }
  recent.push(now);
  attempts.set(ip, recent);
  if (attempts.size > 5000) attempts.clear(); // garde-fou mémoire
  return false;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "inconnue";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez dans une heure." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const parsed = SignupInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Merci de remplir tous les champs correctement." }, { status: 400 });
  }

  try {
    // l'offre est validée AVANT de créer le compte : pas de compte orphelin.
    // Jeton signé (?cart=) ou simple code (?pack=) : dans les deux cas le prix
    // est relu en base, jamais transmis par le navigateur.
    const pack = parsed.data.cartToken
      ? await readCartToken(parsed.data.cartToken)
      : parsed.data.packCode
        ? await findPackByCode(parsed.data.packCode)
        : null;

    const user = await signupClient(parsed.data);

    // commande créée : l'accès reste fermé jusqu'à confirmation du paiement
    if (pack && user.clientId) {
      await createOrderForClient(BigInt(user.clientId), pack.code);
    }
    // connexion immédiate après inscription
    await createSession({
      userId: user.id,
      role: user.role,
      clientId: user.clientId,
      fullName: user.fullName,
      email: user.email,
    });
    if (user.clientId) {
      await recordDetectedCountry(BigInt(user.clientId), req.headers, BigInt(user.id));
    }
    return NextResponse.json({ redirect: "/client" });
  } catch (e) {
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("[signup]", e);
    return NextResponse.json({ error: "Création impossible. Réessayez." }, { status: 500 });
  }
}
