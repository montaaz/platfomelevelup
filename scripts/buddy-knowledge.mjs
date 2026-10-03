#!/usr/bin/env node
/**
 * Construit la base de connaissances publique de l'assistant à partir des
 * dictionnaires du site vitrine (levelupia.agency).
 *
 *   node scripts/buddy-knowledge.mjs [dossier des dictionnaires]
 *
 * Par défaut : ../levelup-ai/src/i18n/dictionaries (dépôt vitrine voisin).
 * Écrit src/buddy/ai/site-knowledge.json — à relancer et à committer quand
 * le contenu du site change. Seul du contenu PUBLIC entre ici : textes déjà
 * affichés sur le site. Les prix des packs n'y sont pas repris : ils sont lus
 * en direct dans la table `packs`, seule source de vérité de la plateforme.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dictDir = resolve(process.argv[2] ?? join(root, "..", "levelup-ai", "src", "i18n", "dictionaries"));
const out = join(root, "src", "buddy", "ai", "site-knowledge.json");

const chunks = [];
const add = (lang, id, title, text) => {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  if (clean) chunks.push({ id: `site:${lang}:${id}`, lang, title: String(title).trim(), text: clean });
};

for (const lang of ["fr", "en"]) {
  const d = JSON.parse(readFileSync(join(dictDir, `${lang}.json`), "utf8"));
  const about = lang === "fr" ? "À propos de Level Up IA" : "About Level Up IA";
  add(lang, "about", about, [d.meta?.description, d.hero?.copy, (d.hero?.proof ?? []).join(". "), d.work?.lead, d.pricing?.lead].filter(Boolean).join(" "));
  const sectors = Object.values(d.carousel?.labels ?? {});
  const ads = Object.values(d.commercials?.clips ?? {}).map((c) => c.label).filter((l) => !/macro/i.test(l));
  const fr = lang === "fr";
  add(lang, "sectors", fr ? "Secteurs et exemples de réalisations" : "Sectors and sample work",
    `${(d.hero?.proof ?? [])[0] ?? ""}. ${fr ? "Exemples de secteurs" : "Sample sectors"} : ${sectors.join(", ")}. ` +
    `${fr ? "Exemples de publicités IA réalisées" : "Sample AI commercials produced"} : ${ads.join(", ")}. ${d.carousel?.lead ?? ""}`);
  add(lang, "services-lead", d.services?.title ?? "Services", d.services?.lead);
  for (const [i, s] of (d.pricing?.aiServices ?? []).entries()) add(lang, `service-${i}`, s.title, s.copy);
  for (const [i, f] of (d.fit?.items ?? []).entries()) add(lang, `approach-${i}`, f.title, f.copy);
  const steps = (d.process?.steps ?? []).map((s, i) => `${i + 1}. ${s.title} : ${s.copy}`).join(" ");
  add(lang, "process", d.process?.title ?? "Process", `${d.process?.lead ?? ""} ${steps}`);
  for (const [i, q] of (d.faq?.items ?? []).entries()) add(lang, `faq-${i}`, q.question, q.answer);
  const points = (d.contact?.points ?? []).map((p) => `${p.title} (${p.copy})`).join(", ");
  add(lang, "contact", d.contact?.title ?? "Contact", `${d.contact?.copy ?? ""} ${d.contact?.cardTitle ?? ""} ${points}`);
}

writeFileSync(out, `${JSON.stringify({ source: "levelupia.agency", generatedAt: new Date().toISOString().slice(0, 10), chunks }, null, 1)}\n`);
console.log(`${chunks.length} extraits écrits dans ${out}`);
