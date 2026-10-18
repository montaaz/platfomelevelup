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

/**
 * Devise d'un client, alignée sur le site vitrine (notes de Sarra, §02 « Devise ») :
 * Tunisie en dinars, Europe en euros, tous les autres pays en dollars américains.
 * Le montant est le même nombre dans chaque devise (890 DT, 890 €, 890 USD).
 */
export type PayCurrency = "TND" | "EUR" | "USD";
const EUROPE = new Set([
  "FR","BE","DE","ES","IT","NL","PT","IE","AT","LU","FI","GR","SK","SI","EE","LV","LT","CY","MT","HR","MC",
  "CH","PL","SE","DK","CZ","HU","RO","BG","NO","IS","LI","AD","SM","VA","AL","BA","ME","MK","RS","XK","MD","UA","GB",
]);
export function currencyForCountryCode(code: string | null | undefined): PayCurrency {
  const c = (code ?? "").trim().toUpperCase();
  if (!c || c === "XX" || c === "T1" || isTunisia(c)) return "TND";
  return EUROPE.has(c) ? "EUR" : "USD";
}
export function clientCurrency(client: { country?: string | null; detectedCountryCode?: string | null }): PayCurrency {
  if (clientIsTunisian(client)) return "TND";
  const code = client.detectedCountryCode ?? null;
  if (code) return currencyForCountryCode(code);
  return "EUR"; // pays saisi en toutes lettres, hors Tunisie, sans code détecté
}
export function requestCurrency(headers: { get(name: string): string | null }): PayCurrency {
  return currencyForCountryCode(headers.get("cf-ipcountry") ?? headers.get("x-vercel-ip-country") ?? headers.get("x-country-code"));
}
