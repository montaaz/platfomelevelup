import type { NextRequest } from "next/server";
import { publicOrigin, stripPublicPort } from "@/lib/publicUrl";

export const STATE_COOKIE = "google_oauth_state";
/** Offre choisie sur le vitrine, conservée pendant l'aller-retour Google. */
export const PACK_COOKIE = "google_oauth_pack";

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
  if (forced && path.startsWith("/api/auth/google")) return `${stripPublicPort(forced)}${path}`;

  const configured = process.env.APP_URL?.replace(/\/+$/, "");
  if (configured) return `${stripPublicPort(configured)}${path}`;

  // Le repli sur les en-têtes subissait la même fuite de port que APP_URL.
  const { host, protocol } = publicOrigin(req.headers);
  return `${protocol}://${host}${path}`;
}
