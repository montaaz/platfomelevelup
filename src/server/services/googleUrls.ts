import type { NextRequest } from "next/server";

export const STATE_COOKIE = "google_oauth_state";

/**
 * Construit une URL absolue à partir de l'hôte réellement utilisé par le
 * navigateur (x-forwarded-* derrière un proxy, sinon Host). Indispensable :
 * Google renvoie exactement sur ce redirect_uri, et req.url pointerait sur
 * localhost derrière Nginx.
 */
export function buildRedirectUri(req: NextRequest, path: string): string {
  // GOOGLE_REDIRECT_BASE force l'URL déclarée chez Google, utile en local :
  // Google n'accepte que les URI exactement enregistrées.
  const forced = process.env.GOOGLE_REDIRECT_BASE?.replace(/\/+$/, "");
  if (forced && path.startsWith("/api/auth/google")) return `${forced}${path}`;

  const configured = process.env.APP_URL?.replace(/\/+$/, "");
  if (configured) return `${configured}${path}`;

  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  const proto =
    req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}${path}`;
}
