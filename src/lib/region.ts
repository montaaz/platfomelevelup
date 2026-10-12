/**
 * Où se trouve le client : décide du moyen de paiement proposé.
 *   - Tunisie → virement sur le RIB (et, quand la banque l'ouvrira, carte en dinars via ClicToPay) ;
 *   - ailleurs → carte en euros via Monetico (Crédit Mutuel), et virement.
 */

const TUNISIA = /^(tn|tunisie|tunisia|تونس)$/i;

export function isTunisia(value: string | null | undefined): boolean {
  return !!value && TUNISIA.test(value.trim());
}

/** Pays d'un client : son profil d'abord, sinon la détection à la connexion. Inconnu → considéré tunisien (offre par défaut). */
export function clientIsTunisian(client: { country?: string | null; detectedCountryCode?: string | null }): boolean {
  if (client.country) return isTunisia(client.country);
  if (client.detectedCountryCode) return isTunisia(client.detectedCountryCode);
  return true;
}

/** Visiteur anonyme (panier) : pays d'après le proxy (Cloudflare / Vercel). Inconnu → tunisien. */
export function requestIsTunisian(headers: { get(name: string): string | null }): boolean {
  const code = headers.get("cf-ipcountry") ?? headers.get("x-vercel-ip-country") ?? headers.get("x-country-code");
  if (!code || code === "XX" || code === "T1") return true;
  return isTunisia(code);
}
