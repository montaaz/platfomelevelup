import { createHmac } from "node:crypto";

/**
 * Monetico Paiement (Crédit Mutuel / CIC) — interface CGI version 3.0.
 *
 * Carte bancaire pour les clients hors Tunisie, débitée en euros. Le parcours :
 *   1. on affiche un formulaire (POST) vers la page de paiement Monetico, scellé
 *      par un MAC HMAC-SHA1 calculé avec la clé du TPE ;
 *   2. le client paie chez Monetico ;
 *   3. Monetico appelle notre « interface retour » (serveur à serveur) avec le
 *      résultat, scellé de la même façon : c'est là que la commande est encaissée ;
 *   4. le client revient sur url_retour_ok / url_retour_err (simple affichage).
 *
 *   MONETICO_TPE="XZ85771"            numéro de TPE (paiement immédiat)
 *   MONETICO_SOCIETE="merchandis"     code société
 *   MONETICO_KEY="…"                  clé de sécurité (40 caractères hexadécimaux), téléchargée sur monetico.com
 *   MONETICO_ENV="test" | "prod"      https://p.monetico-services.com/test/paiement.cgi ou /paiement.cgi
 *   TND_EUR_RATE="1"                  prix hors Tunisie : même nombre, en euros (890 DT → 890 €), comme sur le site vitrine
 */

export const MONETICO_VERSION = "3.0";
const URLS = { test: "https://p.monetico-services.com/test/paiement.cgi", prod: "https://p.monetico-services.com/paiement.cgi" } as const;

export type MoneticoConfig = { tpe: string; societe: string; key: string; url: string; env: "test" | "prod" };

export function readMoneticoConfig(env: Record<string, string | undefined> = process.env): MoneticoConfig | null {
  const tpe = (env.MONETICO_TPE ?? "").trim();
  const societe = (env.MONETICO_SOCIETE ?? "").trim();
  const key = (env.MONETICO_KEY ?? "").trim();
  if (!tpe || !societe || !key) return null;
  if (!/^[0-9A-Fa-f]{38}[0-9A-Za-z]{2}$/.test(key)) {
    console.error("[monetico] MONETICO_KEY invalide (40 caractères attendus) : carte désactivée.");
    return null;
  }
  const mode = /^prod/i.test(env.MONETICO_ENV ?? "") ? "prod" : "test";
  return { tpe, societe, key, url: URLS[mode], env: mode };
}

export function moneticoConfigured(): boolean {
  return readMoneticoConfig() !== null;
}

/**
 * Prix en euros pour un client hors Tunisie : le MÊME nombre que le prix en
 * dinars (890 DT → 890 €), décision commerciale reprise du site vitrine.
 * TND_EUR_RATE permet d'appliquer un vrai taux si cette décision change.
 */
export function tndToEur(amountTnd: number | string, env: Record<string, string | undefined> = process.env): number {
  const rate = Number(env.TND_EUR_RATE ?? "1");
  return Math.round(Number(amountTnd) * (Number.isFinite(rate) && rate > 0 ? rate : 1) * 100) / 100;
}

/**
 * Décodage de la clé tel que le kit officiel Monetico le fait (`getUsableKey`) :
 * 38 caractères hexadécimaux, puis deux caractères dont le premier peut être
 * une lettre G–Z à ramener dans l'alphabet hexadécimal.
 */
export function usableKey(key: string): Buffer {
  let hex = key.slice(0, 38);
  const tail = key.slice(38, 40) + "00";
  const c0 = tail.charCodeAt(0);
  if (c0 > 70 && c0 < 97) hex += String.fromCharCode(c0 - 23) + tail.charAt(1);
  else if (tail.charAt(1) === "M") hex += tail.charAt(0) + "0";
  else hex += tail.slice(0, 2);
  return Buffer.from(hex, "hex");
}

/** Sceau v3.0 : tous les champs sauf MAC, triés par nom, « nom=valeur » joints par « * ». */
export function computeMac(fields: Record<string, string>, key: string): string {
  const payload = Object.keys(fields)
    .filter((k) => k !== "MAC")
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join("*");
  return createHmac("sha1", usableKey(key)).update(payload, "utf8").digest("hex").toLowerCase();
}

/** Date au format Monetico : jj/mm/aaaa:hh:mm:ss (heure de Paris). */
export function moneticoDate(d = new Date()): string {
  const p = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
  return `${g("day")}/${g("month")}/${g("year")}:${g("hour")}:${g("minute")}:${g("second")}`;
}

export type PaymentRequest = {
  /** 12 caractères alphanumériques au plus, unique. */
  reference: string;
  amountEur: number;
  email: string;
  lang: "FR" | "EN";
  urlRetourOk: string;
  urlRetourErr: string;
  /** Repris tel quel dans la notification : notre identifiant interne. */
  texteLibre?: string;
  billing: { name?: string; addressLine1?: string; city?: string; postalCode?: string; country: string };
};

/** Le formulaire à poster chez Monetico (champs cachés + action). */
export function buildPaymentForm(req: PaymentRequest, cfg: MoneticoConfig): { action: string; fields: Record<string, string> } {
  const reference = req.reference.replace(/[^A-Za-z0-9]/g, "").slice(0, 12);
  const contexte = {
    billing: {
      ...(req.billing.name ? { name: req.billing.name.slice(0, 45) } : {}),
      addressLine1: (req.billing.addressLine1 || "Adresse non communiquée").slice(0, 50),
      city: (req.billing.city || "Ville non communiquée").slice(0, 50),
      postalCode: (req.billing.postalCode || "00000").slice(0, 10),
      country: (req.billing.country || "FR").toUpperCase().slice(0, 2),
    },
  };
  const fields: Record<string, string> = {
    TPE: cfg.tpe,
    contexte_commande: Buffer.from(JSON.stringify(contexte), "utf8").toString("base64"),
    date: moneticoDate(),
    lgue: req.lang,
    mail: req.email.slice(0, 80),
    montant: `${req.amountEur.toFixed(2)}EUR`,
    reference,
    societe: cfg.societe,
    url_retour_err: req.urlRetourErr,
    url_retour_ok: req.urlRetourOk,
    version: MONETICO_VERSION,
    ...(req.texteLibre ? { "texte-libre": req.texteLibre.slice(0, 3200) } : {}),
  };
  fields.MAC = computeMac(fields, cfg.key);
  return { action: cfg.url, fields };
}

export type Notification = {
  valid: boolean;
  /** « payetest » (environnement de test) ou « paiement » : la carte a été débitée. */
  paid: boolean;
  codeRetour: string;
  reference: string;
  amountEur: number | null;
  currency: string | null;
  authorization: string | null;
  texteLibre: string | null;
  motifRefus: string | null;
};

/** Vérifie le sceau de l'interface retour et lit le résultat. */
export function readNotification(fields: Record<string, string>, cfg: MoneticoConfig): Notification {
  const given = (fields.MAC ?? "").toLowerCase();
  const expected = computeMac(fields, cfg.key);
  const valid = given.length === 40 && given === expected;
  const code = fields["code-retour"] ?? "";
  const montant = fields.montant ?? "";
  const m = montant.match(/^([\d.]+)([A-Z]{3})$/);
  return {
    valid,
    paid: valid && (code === "paiement" || code === "payetest"),
    codeRetour: code,
    reference: fields.reference ?? "",
    amountEur: m ? Number(m[1]) : null,
    currency: m ? m[2]! : null,
    authorization: fields.numauto ?? null,
    texteLibre: fields["texte-libre"] ?? null,
    motifRefus: fields.motifrefus ?? null,
  };
}

/** Réponse attendue par Monetico sur l'interface retour. */
export const NOTIFICATION_OK = "version=2\ncdr=0\n";
export const NOTIFICATION_KO = "version=2\ncdr=1\n";
