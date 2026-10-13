import type { Option } from "@/lib/onboardingOptions";

/**
 * Le détail de chaque besoin du questionnaire d'accueil (étape « Vos besoins »).
 *
 * Même principe que onboardingOptions.ts : une seule source pour le formulaire
 * client, la validation serveur et l'affichage (espace client, fiche admin,
 * fiche projet). Ce qui est stocké en base est la clé, jamais le libellé.
 */

export const PAGES: Option[] = [
  { value: "ACCUEIL", label: "Accueil" }, { value: "A_PROPOS", label: "À propos" }, { value: "QUI_SOMMES_NOUS", label: "Qui sommes-nous ?" },
  { value: "ACTIVITES", label: "Activités" }, { value: "SERVICES", label: "Services" }, { value: "PRODUITS", label: "Nos produits" },
  { value: "ADRESSES", label: "Nos adresses" }, { value: "REALISATIONS", label: "Réalisations" }, { value: "GALERIE", label: "Galerie photos" },
  { value: "AVIS", label: "Avis clients" }, { value: "BLOG", label: "Blog / actualités" }, { value: "FAQ", label: "FAQ" },
  { value: "TARIFS", label: "Tarifs" }, { value: "NEWSLETTER", label: "Lettre d'information" }, { value: "CARTE", label: "Carte / plan d'accès" },
  { value: "RDV", label: "Prise de rendez-vous" }, { value: "CONTACT", label: "Contact" }, { value: "MENTIONS", label: "Mentions légales" },
  { value: "CONFIDENTIALITE", label: "Politique de confidentialité" },
];

export type Palette = Option & { colors: [string, string, string] };
export const PALETTES: Palette[] = [
  { value: "BLEU_BLANC", label: "Bleu et blanc", colors: ["#1e3a8a", "#60a5fa", "#e0f2fe"] },
  { value: "VERT_SAUGE", label: "Vert sauge et crème", colors: ["#6b8f71", "#a3b899", "#f5f0e1"] },
  { value: "SABLE_TERRACOTTA", label: "Sable et terracotta", colors: ["#c9a27e", "#c2613f", "#f3e9dc"] },
  { value: "ROSE_BORDEAUX", label: "Rose et bordeaux", colors: ["#e8a0b4", "#8b1e3f", "#f9e4ea"] },
  { value: "NOIR_DORE", label: "Noir et doré", colors: ["#111111", "#c9a227", "#e8e2d0"] },
  { value: "VIOLET_LAVANDE", label: "Violet et lavande", colors: ["#6d28d9", "#c4b5fd", "#ede9fe"] },
];

export const STYLES: Option[] = [
  { value: "MODERNE", label: "Moderne / futuriste" }, { value: "MINIMALISTE", label: "Minimaliste" }, { value: "ELEGANT", label: "Élégant" },
  { value: "NATUREL", label: "Naturel" }, { value: "CHALEUREUX", label: "Chaleureux" }, { value: "AUDACIEUX", label: "Audacieux" },
];

/** Un champ du sous-formulaire d'un besoin. */
export type NeedField =
  | { key: string; kind: "text"; label: string; placeholder: string; required?: boolean }
  | { key: string; kind: "pages"; label: string }
  | { key: string; kind: "palette"; label: string }
  | { key: string; kind: "styles"; label: string }
  | { key: string; kind: "call"; label: string; hint: string };

export type NeedSpec = { title: string; hint: string; fields: NeedField[]; attachNote: string };

/** Ce que chaque besoin demande — l'ordre est celui de l'affichage. */
export const NEED_SPECS: Record<string, NeedSpec> = {
  SITE_WEB: {
    title: "Décrivez votre projet de site vitrine",
    hint: "Décrivez votre activité, puis indiquez les rubriques à prévoir.",
    fields: [
      { key: "description", kind: "text", label: "Présentez votre activité", placeholder: "Votre activité, vos services ou les produits à présenter…", required: true },
      { key: "pages", kind: "pages", label: "Pages et fonctionnalités souhaitées" },
      { key: "palette", kind: "palette", label: "Quelle palette de couleurs souhaitez-vous ?" },
      { key: "styles", kind: "styles", label: "Quel style ou quelle ambiance préférez-vous ?" },
    ],
    attachNote: "Si vous avez déjà un logo, un site de référence ou d'autres détails sur votre projet, envoyez-les-nous par e-mail.",
  },
  SITE_MARCHAND: {
    title: "Décrivez votre projet de site marchand",
    hint: "Précisez les produits à vendre et les fonctions souhaitées pour votre boutique en ligne.",
    fields: [
      { key: "description", kind: "text", label: "Description de votre projet", placeholder: "Produits à vendre, nombre d'articles, paiement, livraison…", required: true },
      { key: "pages", kind: "pages", label: "Pages et fonctionnalités souhaitées" },
      { key: "palette", kind: "palette", label: "Quelle palette de couleurs souhaitez-vous ?" },
      { key: "styles", kind: "styles", label: "Quel style ou quelle ambiance préférez-vous ?" },
      { key: "call", kind: "call", label: "Échange de 30 minutes", hint: "Un échange de 30 minutes est très important pour mieux comprendre votre activité. Vous pouvez aussi nous envoyer tous les détails de votre projet par e-mail." },
    ],
    attachNote: "Si vous avez déjà un logo, un site de référence ou d'autres détails sur votre projet, envoyez-les-nous par e-mail.",
  },
  SHOOTING: {
    title: "Votre projet de shooting de produits",
    hint: "Répondez aux questions pour décrire votre séance photo ou vidéo.",
    fields: [
      { key: "products", kind: "text", label: "Quels produits souhaitez-vous présenter ?", placeholder: "Décrivez les produits à photographier ou à filmer…", required: true },
      { key: "expected", kind: "text", label: "Quel résultat souhaitez-vous obtenir ?", placeholder: "Décrivez le résultat attendu…" },
      { key: "mood", kind: "text", label: "Mood désiré", placeholder: "Exemple : naturel, élégant, coloré…" },
    ],
    attachNote: "Photos ou références à partager ? Contactez-nous par e-mail pour nous les envoyer.",
  },
  VIDEOS: {
    title: "Décrivez la vidéo que vous imaginez",
    hint: "Indiquez le sujet, le style, le résultat et l'ambiance recherchés.",
    fields: [
      { key: "subject", kind: "text", label: "Sujet", placeholder: "Quel sujet souhaitez-vous présenter ?", required: true },
      { key: "style", kind: "text", label: "Style souhaité", placeholder: "Exemple : tutoriel, témoignage, présentation…" },
      { key: "expected", kind: "text", label: "Résultat recherché", placeholder: "Quel résultat souhaitez-vous obtenir ?" },
      { key: "mood", kind: "text", label: "Mood désiré", placeholder: "Exemple : naturelle, dynamique, élégante…" },
    ],
    attachNote: "Vous avez une vidéo de référence ou une photo à retoucher ? Envoyez-la-nous par e-mail.",
  },
  PUBLICITE: {
    title: "Vos campagnes publicitaires",
    hint: "Où, pour quel objectif, avec quel budget indicatif ?",
    fields: [{ key: "description", kind: "text", label: "Décrivez votre besoin", placeholder: "Réseaux visés (Meta, Google, TikTok…), objectif, budget mensuel indicatif, période…" }],
    attachNote: "Vous avez déjà des visuels ou d'anciennes campagnes ? Envoyez-les-nous par e-mail.",
  },
  IDENTITE: {
    title: "Décrivez l'identité visuelle souhaitée",
    hint: "Choisissez une palette, puis les styles qui vous correspondent.",
    fields: [
      { key: "palette", kind: "palette", label: "Quelle palette de couleurs vous attire le plus ?" },
      { key: "styles", kind: "styles", label: "Quel style ou quelle ambiance préférez-vous ?" },
      { key: "notes", kind: "text", label: "Autres couleurs, références ou précisions", placeholder: "Ajoutez les détails qui vous semblent utiles…" },
    ],
    attachNote: "Vous avez déjà un logo ou une référence ? Envoyez-les-nous par e-mail avec les détails de votre projet.",
  },
  CHATBOT: {
    title: "Votre assistant ou automatisation",
    hint: "Que doit-il faire, sur quels canaux, pour quels clients ?",
    fields: [{ key: "description", kind: "text", label: "Décrivez votre besoin", placeholder: "Exemple : répondre aux questions sur WhatsApp et Instagram, prendre des rendez-vous, relancer les devis…" }],
    attachNote: "Vous avez une liste de questions fréquentes ou des exemples d'échanges ? Envoyez-les-nous par e-mail.",
  },
};

export type NeedDetails = Record<string, { [key: string]: string | string[] | boolean }>;

const TEXT_MAX = 2000;

/**
 * Nettoie et valide le détail des besoins : seuls les besoins cochés sont
 * gardés, seuls les champs prévus, seules les valeurs du catalogue.
 */
export function cleanNeedsDetails(mainNeeds: string[], raw: unknown): NeedDetails {
  const out: NeedDetails = {};
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  for (const need of mainNeeds) {
    const spec = NEED_SPECS[need];
    const given = src[need];
    if (!spec || !given || typeof given !== "object") continue;
    const g = given as Record<string, unknown>;
    const d: NeedDetails[string] = {};
    for (const f of spec.fields) {
      const v = g[f.key];
      if (f.kind === "text") {
        const t = typeof v === "string" ? v.trim().slice(0, TEXT_MAX) : "";
        if (t) d[f.key] = t;
      } else if (f.kind === "pages" || f.kind === "styles") {
        const list = f.kind === "pages" ? PAGES : STYLES;
        if (Array.isArray(v)) {
          const keep = [...new Set(v.filter((x): x is string => typeof x === "string" && list.some((o) => o.value === x)))];
          if (keep.length) d[f.key] = keep.sort((a, b) => list.findIndex((o) => o.value === a) - list.findIndex((o) => o.value === b));
        }
      } else if (f.kind === "palette") {
        if (typeof v === "string" && PALETTES.some((p) => p.value === v)) d[f.key] = v;
      } else if (f.kind === "call") {
        if (v === true) d[f.key] = true;
      }
    }
    if (Object.keys(d).length) out[need] = d;
  }
  return out;
}

export type SummaryRow = { label: string; text?: string; chips?: string[]; palette?: Palette; flag?: boolean };
export type NeedSummary = { need: string; title: string; rows: SummaryRow[] };

/** Lecture humaine du détail enregistré, pour l'espace client et l'administration. */
export function needsSummary(mainNeeds: string[], details: unknown, needLabel: (code: string) => string): NeedSummary[] {
  const d = (details && typeof details === "object" ? details : {}) as NeedDetails;
  return mainNeeds.map((need) => {
    const spec = NEED_SPECS[need];
    const given = d[need] ?? {};
    const rows: SummaryRow[] = [];
    for (const f of spec?.fields ?? []) {
      const v = given[f.key];
      if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) continue;
      if (f.kind === "text") rows.push({ label: f.label, text: String(v) });
      else if (f.kind === "pages") rows.push({ label: f.label, chips: (v as string[]).map((x) => PAGES.find((o) => o.value === x)?.label ?? x) });
      else if (f.kind === "styles") rows.push({ label: f.label, chips: (v as string[]).map((x) => STYLES.find((o) => o.value === x)?.label ?? x) });
      else if (f.kind === "palette") rows.push({ label: f.label, palette: PALETTES.find((p) => p.value === v) });
      else if (f.kind === "call" && v === true) rows.push({ label: "Échange téléphonique", text: "Le client souhaite un échange de 30 minutes.", flag: true });
    }
    return { need, title: needLabel(need), rows };
  });
}

export const CONTACT_MAILTO = "mailto:contact@levelupia.agency?subject=" + encodeURIComponent("Détails de mon projet — Level Up IA");
