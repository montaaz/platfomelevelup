import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { signupClient } from "@/server/services/signup";
import { createSession } from "@/lib/session";
import { recordDetectedCountry } from "@/server/services/geo";
import { ValidationError } from "@/server/context";
import { claimPrepaidFromCookie } from "@/server/prepaidClaim";
import { recordTermsAcceptance } from "@/server/services/signup";
import { readCartToken, findPackByCode, createOrderForClient } from "@/server/services/orders";

const SignupInput = z.object({
  fullName: z.string().min(1).max(160),
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
  confirmPassword: z.string().min(1).max(200),
  // Offre éventuellement choisie sur le site vitrine. Le formulaire lit ces
  // valeurs dans l'URL avec `searchParams.get()`, qui renvoie `null` quand le
  // paramètre est absent : il faut donc accepter `null` autant que l'absence,
  // sans quoi toute inscription directe serait refusée.
  cartToken: z.string().max(2000).nullish(),   // jeton signé (?cart=)
  packCode: z.string().max(40).nullish(),      // code d'offre (?pack=)
  // Case « J'accepte les conditions générales » : obligatoire (migration 014).
  acceptTerms: z.boolean().optional(),
});

/** Message précis pour le premier champ fautif, plutôt qu'une phrase passe-partout. */
const FIELD_LABEL: Record<string, string> = {
  fullName: "Merci d'indiquer votre nom complet.",
  email: "Adresse e-mail invalide.",
  password: "Merci de saisir un mot de passe.",
  confirmPassword: "Merci de confirmer votre mot de passe.",
};

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
    const field = parsed.error.issues[0]?.path[0];
    const message =
      (typeof field === "string" ? FIELD_LABEL[field] : undefined) ??
      "Merci de remplir tous les champs correctement.";
    // Le détail va au journal : l'écran reste sobre, le débogage reste possible.
    console.warn("[signup] saisie refusée:", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (parsed.data.acceptTerms !== true) {
    return NextResponse.json(
      { error: "Merci d'accepter les conditions générales d'utilisation et de vente." },
      { status: 400 },
    );
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
    if (user.clientId) await recordTermsAcceptance(BigInt(user.clientId));

    // commande créée : l'accès reste fermé jusqu'à confirmation du paiement
    // — sauf si l'offre vient d'être payée depuis le panier du site vitrine :
    // ce paiement devient alors la commande, déjà réglée.
    const prepaid = await claimPrepaidFromCookie(user.clientId);
    let toPay = false;
    if (!prepaid && pack && user.clientId) {
      await createOrderForClient(BigInt(user.clientId), pack.code);
      toPay = true;
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
    // Une commande vient d'être créée : le client règle tout de suite (carte ou
    // virement), puis entre dans son espace.
    return NextResponse.json({ redirect: toPay ? "/paiement" : "/client" });
  } catch (e) {
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("[signup]", e);
    return NextResponse.json({ error: "Création impossible. Réessayez." }, { status: 500 });
  }
}
