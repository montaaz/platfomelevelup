import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import {
  exchangeCodeForTokens,
  verifyGoogleIdToken,
  findOrCreateGoogleUser,
  googleConfigured,
} from "@/server/services/googleAuth";
import { buildRedirectUri, STATE_COOKIE, PACK_COOKIE } from "@/server/services/googleUrls";
import { createSession } from "@/lib/session";
import { findPackByCode, createOrderForClient } from "@/server/services/orders";
import { recordDetectedCountry } from "@/server/services/geo";
import { ValidationError } from "@/server/context";

function backToLogin(req: NextRequest, code: string) {
  return NextResponse.redirect(`${buildRedirectUri(req, "/login")}?error=${code}`, 307);
}

/** Retour de Google : vérifie l'état, valide le jeton, ouvre la session. */
export async function GET(req: NextRequest) {
  if (!googleConfigured()) return backToLogin(req, "google_indisponible");

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const googleError = url.searchParams.get("error");

  if (googleError) return backToLogin(req, "google_annule");
  if (!code || !state) return backToLogin(req, "google_incomplet");

  // anti-CSRF : le state doit correspondre au cookie posé au départ
  const store = await cookies();
  const expected = store.get(STATE_COOKIE)?.value;
  store.delete(STATE_COOKIE);
  // offre choisie sur le vitrine, mise de côté avant l'aller-retour Google
  const packCode = store.get(PACK_COOKIE)?.value ?? null;
  store.delete(PACK_COOKIE);
  if (!expected || expected !== state) return backToLogin(req, "google_state");

  try {
    const tokens = await exchangeCodeForTokens(
      code,
      buildRedirectUri(req, "/api/auth/google/callback"),
    );
    if (!tokens.id_token) return backToLogin(req, "google_incomplet");

    const profile = await verifyGoogleIdToken(tokens.id_token);
    const user = await findOrCreateGoogleUser(profile);

    // Enregistre la commande si une offre a été choisie sur le vitrine.
    // Le prix est relu en base ; une offre inconnue n'empêche pas la connexion.
    if (packCode && user.clientId) {
      try {
        const pack = await findPackByCode(packCode);
        await createOrderForClient(user.clientId, pack.code);
      } catch (e) {
        console.error("[google callback] commande non créée:", e);
      }
    }

    await createSession({
      userId: user.id.toString(),
      role: user.role,
      clientId: user.clientId?.toString() ?? null,
      fullName: user.fullName,
      email: user.email,
    });

    if (user.clientId) await recordDetectedCountry(user.clientId, req.headers, user.id);

    const target = user.role === "ADMIN" ? "/admin" : "/client";
    return NextResponse.redirect(buildRedirectUri(req, target), 307);
  } catch (e) {
    if (e instanceof ValidationError) {
      return NextResponse.redirect(
        `${buildRedirectUri(req, "/login")}?error=${encodeURIComponent(e.message)}`,
        307,
      );
    }
    console.error("[google callback]", e);
    return backToLogin(req, "google_erreur");
  }
}
