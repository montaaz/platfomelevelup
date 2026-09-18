import type { NextRequest } from "next/server";

export const STATE_COOKIE = "google_oauth_state";
/** Offre choisie sur le vitrine, conservée pendant l'aller-retour Google. */
export const PACK_COOKIE = "google_oauth_pack";

/**
 * Construit une URL absolue à partir de l'hôte réellement utilisé par le
 * navigateur (x-forwarded-* derrière un proxy, sinon Host). Indispensable :
 * Google renvoie exactement sur ce redirect_uri, et req.url pointerait sur
 * localhost derrière Nginx.
 */
/**
 * Retire un port d'une base publique en HTTPS : « https://site.app:3000 » est
 * presque toujours une erreur de configuration (le port interne recopié dans
 * APP_URL), et produit des liens injoignables depuis l'extérieur.
 */
function stripPublicPort(base: string): string {
  try {
    const u = new URL(base);
    if (u.protocol === "https:" && u.port) u.port = "";
    return u.toString().replace(/\/+$/, "");
  } catch {
    return base;
  }
}

export function buildRedirectUri(req: NextRequest, path: string): string {
  // GOOGLE_REDIRECT_BASE force l'URL déclarée chez Google, utile en local :
  // Google n'accepte que les URI exactement enregistrées.
  const forced = process.env.GOOGLE_REDIRECT_BASE?.replace(/\/+$/, "");
  if (forced && path.startsWith("/api/auth/google")) return `${stripPublicPort(forced)}${path}`;

  const configured = process.env.APP_URL?.replace(/\/+$/, "");
  if (configured) return `${stripPublicPort(configured)}${path}`;

  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  const proto =
    req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}${path}`;
}
