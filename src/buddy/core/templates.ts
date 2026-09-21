/**
 * Petits outils de mise en forme des réponses.
 *
 * Les réponses sont des gabarits fixes remplis avec des données lues en base
 * ou dans les dictionnaires — jamais du texte composé librement. Ces
 * fonctions ne font qu'assembler proprement ce qui leur est passé.
 */

/** « 1 facture », « 3 factures ». Le pluriel français vaut dès 2. */
export function plural(n: number, one: string, many: string = `${one}s`): string {
  return `${n} ${n >= 2 ? many : one}`;
}

/** Une liste à puces, une entrée par ligne. */
export function bullets(items: string[]): string {
  return items.map((item) => `• ${item}`).join("\n");
}

/** Une liste numérotée, une entrée par ligne. */
export function numbered(items: string[]): string {
  return items.map((item, i) => `${i + 1}. ${item}`).join("\n");
}

/** Coupe proprement un texte trop long, sur un mot, avec une ellipse. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Assemble des blocs de texte, en ignorant les vides. */
export function paragraphs(...blocks: (string | null | undefined | false)[]): string {
  return blocks.filter((b): b is string => typeof b === "string" && b.trim().length > 0).join("\n\n");
}
