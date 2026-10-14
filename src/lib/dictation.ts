/**
 * Dictée vocale : le texte entendu (navigateur ou Baarcha « fennec ») est
 * relu par le modèle Baarcha, qui corrige orthographe, grammaire et
 * ponctuation sans changer le sens. Fonctions pures, testées à part.
 */

export const MAX_DICTATION_CHARS = 4000;

/** Hésitations et répétitions de l'oral, retirées avant correction. */
export function tidyTranscript(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/\b(euh+|heu+|hum+|bah|ben|hein|uh+|um+|er+)\b[,\s]*/gi, "")
    .replace(/\b(\w{3,})\s+\1\b/gi, "$1") // « le le site » → « le site »
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim()
    .slice(0, MAX_DICTATION_CHARS);
}

/** Consigne donnée au modèle : corriger, jamais réécrire ni répondre. */
export function correctionPrompt(context: string | null, lang: "fr" | "en" | "auto"): string {
  const langue = lang === "en" ? "en anglais" : lang === "fr" ? "en français" : "dans la langue du texte (français, anglais ou arabe ; un dialecte tunisien est transcrit en français)";
  return [
    "Tu es un correcteur de dictée vocale pour un formulaire.",
    `Le texte ci-dessous a été dicté à l'oral${context ? ` pour le champ « ${context} »` : ""}.`,
    `Réécris-le ${langue}, en corrigeant uniquement l'orthographe, la grammaire, les accords, la ponctuation et les majuscules.`,
    "Règles strictes :",
    "1. Garde exactement le sens, les chiffres, les noms propres et l'ordre des idées ; n'ajoute aucune information, aucun commentaire, aucune réponse.",
    "2. Retire les hésitations (euh, hum) et les répétitions involontaires.",
    "3. Un mot mal reconnu mais devinable d'après le contexte est remplacé par le mot voulu.",
    "4. Réponds uniquement par le texte corrigé, sans guillemets, sans titre, sans explication.",
    "5. Si le texte est vide ou inintelligible, réponds exactement : VIDE",
  ].join("\n");
}

/** Garde-fou : la correction doit rester une correction (même taille, même propos), sinon on garde l'original. */
export function acceptCorrection(original: string, corrected: string): boolean {
  const c = corrected.trim();
  if (!c || /^VIDE$/i.test(c) || /^(INCONNU|UNKNOWN)$/i.test(c)) return false;
  if (/^(je suis|i am|as an ai|en tant qu'ia|désolé|sorry)/i.test(c) && !/^(je suis|i am)/i.test(original.trim())) return false;
  const ratio = c.length / Math.max(1, original.trim().length);
  if (ratio < 0.45 || ratio > 1.8) return false;
  // Les nombres doivent survivre à la correction.
  const nums = original.match(/\d+/g) ?? [];
  if (!nums.every((n) => c.includes(n))) return false;
  return true;
}

/** Ajoute un texte dicté à la fin d'un champ, avec l'espace ou le saut de ligne qu'il faut. */
export function appendDictation(current: string, dictated: string): string {
  const base = current.replace(/\s+$/, "");
  const add = dictated.trim();
  if (!add) return current;
  if (!base) return add;
  return /[.!?…]$/.test(base) ? `${base} ${add}` : `${base}, ${add.charAt(0).toLowerCase()}${add.slice(1)}`;
}
