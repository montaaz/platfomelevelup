import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { googleConfigured, googleClientId } from "@/server/services/googleAuth";
import { buildRedirectUri, STATE_COOKIE, PACK_COOKIE } from "@/server/services/googleUrls";

/** Démarre la connexion Google : redirige vers l'écran de consentement. */
export async function GET(req: NextRequest) {
  if (!googleConfigured()) {
    return NextResponse.redirect(
      new URL("/login?error=google_indisponible", buildRedirectUri(req, "/")),
      307,
    );
  }

  // state anti-CSRF : généré ici, vérifié au retour
  const state = crypto.randomBytes(24).toString("base64url");
  const store = await cookies();
  store.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: buildRedirectUri(req, "/").startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });

  // l'offre choisie est mise de côté le temps de l'aller-retour Google
  const pack = req.nextUrl.searchParams.get("pack");
  if (pack && /^[A-Z_]{2,40}$/.test(pack)) {
    store.set(PACK_COOKIE, pack, {
      httpOnly: true,
      secure: buildRedirectUri(req, "/").startsWith("https://"),
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
    });
  }

  const params = new URLSearchParams({
    client_id: googleClientId(),
    redirect_uri: buildRedirectUri(req, "/api/auth/google/callback"),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 307);
}
