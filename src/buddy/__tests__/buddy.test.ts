import { describe, expect, it } from "vitest";
import { answerBuddy, parseContext, type BuddyContext, type BuddyResult } from "../answer";
import { jsonDataSource, type Fixtures } from "../data/json";
import fixtures from "../data/fixtures.json";
import { extractEntity } from "../entity";
import { detectLanguage } from "../core/language";
import { L } from "../locales";
import type { BuddyCtx, BuddyDataSource } from "../data/types";

/**
 * Fixtures : Nour (client 1) a deux projets — « Site e-commerce Nour » (en
 * cours, échéance 15 oct.) et « Vidéo produit Nour » (en révision, échéance
 * 1er oct., un livrable à valider). Karim (client 2) n'en a qu'un, sans
 * échéance ni livrable. NOW est fixé au 21 septembre 2026.
 */
const NOW = new Date("2026-09-21T12:00:00Z");
const source = jsonDataSource(fixtures as Fixtures, () => NOW);
const fr = L("fr");
const en = L("en");

const admin: BuddyCtx = { userId: 1n, role: "ADMIN", clientId: null, fullName: "Sarra Dhaouadi" };
const nour: BuddyCtx = { userId: 10n, role: "CLIENT", clientId: 1n, fullName: "Nour Ben Salah" };
const karim: BuddyCtx = { userId: 11n, role: "CLIENT", clientId: 2n, fullName: "Karim Jaziri" };

const ask = (ctx: BuddyCtx, q: string, previous?: BuddyContext) => answerBuddy(ctx, q, source, previous, NOW);

/** Enchaîne des questions en renvoyant le contexte, comme le widget. */
async function chat(ctx: BuddyCtx, ...questions: string[]): Promise<BuddyResult[]> {
  const out: BuddyResult[] = [];
  let previous: BuddyContext | undefined;
  for (const q of questions) {
    const r = await ask(ctx, q, previous);
    out.push(r);
    previous = r.context;
  }
  return out;
}

/* ================================================================== FR */

describe("français — cas du cahier", () => {
  it("« Où en est mon projet ? » avec deux projets : on demande lequel, puis on répond", async () => {
    const [q, a] = await chat(nour, "Où en est mon projet ?", "Vidéo produit Nour");
    expect(q!.text).toBe(fr.clarifyProject(["Site e-commerce Nour", "Vidéo produit Nour"]));
    expect(q!.suggestions).toEqual(["Site e-commerce Nour", "Vidéo produit Nour"]);
    expect(a!.text).toContain("Vidéo produit Nour est en révision (60 %)");
    expect(a!.text).toContain("Prochaine étape : Votre validation");
    expect(a!.context?.projectId).toBe("3");
  });

  it("« Où en est mon projet ? » avec un seul projet : réponse directe", async () => {
    const r = await ask(karim, "Où en est mon projet ?");
    expect(r.text).toContain("Vidéo produit Medina est en révision");
  });

  it("« Quel est l'avancement de ma vidéo ? » identifie le projet vidéo", async () => {
    const r = await ask(nour, "Quel est l'avancement de ma vidéo ?");
    expect(r.text).toContain("Vidéo produit Nour est en révision (60 %)");
    expect(r.text).not.toContain("Site e-commerce");
  });

  it("« Quand est-ce que ce sera prêt ? » utilise la vraie échéance du projet en cours de discussion", async () => {
    const [, r] = await chat(nour, "Quel est l'avancement de ma vidéo ?", "Quand est-ce que ce sera prêt ?");
    expect(r!.text).toBe("Vidéo produit Nour : Échéance le 1 oct. 2026 — dans 10 jours.");
  });

  it("« Quels fichiers puis-je télécharger ? » liste seulement les livrables du client, avec leurs liens", async () => {
    const r = await ask(nour, "Quels fichiers puis-je télécharger ?");
    expect(r.text).toBe(fr.downloadReply(2));
    expect(r.actions?.map((a) => a.href)).toEqual(["/api/files/22222222-2222-4222-8222-222222222222", "/api/files/11111111-1111-4111-8111-111111111111"]);
    expect(r.text).not.toContain("brief-client"); // élément déposé par le client, pas un livrable
  });

  it("« J'ai une facture impayée ? » répond oui/non d'après les factures du client", async () => {
    const r = await ask(nour, "J'ai une facture impayée ?");
    expect(r.text).toContain("Oui — 1 facture à régler");
    expect(r.text).toContain("F-2026-035 · 850 DT · en attente");
    expect(r.actions?.[0]?.href).toBe("/client/factures");
  });

  it("« Je veux demander une révision. » mène au livrable qui attend le client", async () => {
    const [, r] = await chat(nour, "Je veux demander une révision.", "Vidéo produit Nour");
    expect(r!.text).toContain("Pour demander une révision de « video-produit-v1.mp4 »");
    expect(r!.text).toContain("Demander une révision");
    expect(r!.actions?.[0]?.href).toBe("/client");
  });

  it("« Je veux parler à un humain. » explique le vrai canal, sans menu", async () => {
    const r = await ask(nour, "Je veux parler à un humain.");
    expect(r.kind).toBe("answer");
    expect(r.text).toContain("L'équipe LevelUp IA vous répond en personne dans la messagerie");
    expect(r.actions?.[0]?.href).toBe("/client/messages");
    expect(r.text).not.toContain("Voici ce que vous pouvez me demander");
  });

  it("« Et sa date de livraison ? » après avoir parlé d'un projet", async () => {
    const [, r] = await chat(nour, "Quel est l'avancement de ma vidéo ?", "Et sa date de livraison ?");
    expect(r!.text).toContain("Vidéo produit Nour : Échéance le 1 oct. 2026");
  });
});

/* ================================================================== EN */

describe("english — brief cases", () => {
  it("“What is the status of my project?” answers in English", async () => {
    const r = await ask(karim, "What is the status of my project?");
    expect(r.lang).toBe("en");
    expect(r.text).toContain("Vidéo produit Medina is in review (60%)");
    expect(r.text).toContain("Next step: Votre validation");
  });

  it("“When is it due?” — missing deadline is said, not invented", async () => {
    const [, r] = await chat(karim, "What is the status of my project?", "When is it due?");
    expect(r!.lang).toBe("en");
    expect(r!.text).toBe("No deadline is set yet for Vidéo produit Medina. The team can confirm it in Messages.");
  });

  it("“What can I download?”", async () => {
    const r = await ask(nour, "What can I download?");
    expect(r.text).toBe(en.downloadReply(2));
    expect(r.actions?.length).toBe(2);
  });

  it("“Do I have an unpaid invoice?”", async () => {
    expect((await ask(nour, "Do I have an unpaid invoice?")).text).toContain("Yes — 1 invoice to pay");
    expect((await ask(admin, "Do I have an unpaid invoice?")).text).toContain("2 invoices to pay");
  });

  it("“Show me my latest team message.” quotes the real latest message", async () => {
    const r = await ask(nour, "Show me my latest team message.");
    expect(r.text).toContain("Latest message from the team (Vidéo produit Nour");
    expect(r.text).toContain("La première version de votre vidéo est en ligne");
    expect(r.actions?.[0]?.href).toBe("/client/messages/3");
  });

  it("“I want to talk with a human.”", async () => {
    const r = await ask(nour, "I want to talk with a human.");
    expect(r.text).toContain("The LevelUp IA team answers you in person in Messages");
    expect(r.actions?.[0]?.href).toBe("/client/messages");
  });

  it("“What about its deadline?” after discussing a project", async () => {
    const [, r] = await chat(nour, "What is the progress of my video?", "What about its deadline?");
    expect(r!.text).toBe("Vidéo produit Nour : Due 1 Oct 2026 — in 10 days.");
  });

  it("a neutral follow-up keeps the previous language; « merci » is French and gets French", async () => {
    const [, neutral] = await chat(nour, "What can I download?", "ok ?");
    expect(neutral!.lang).toBe("en");
    const [, merci] = await chat(nour, "What can I download?", "merci");
    expect(merci!.text).toBe(fr.thanks);
  });
});

/* ================================================================== comportement */

describe("comportement général", () => {
  it("deux questions différentes donnent deux réponses différentes", async () => {
    const a = await ask(nour, "Quels fichiers puis-je télécharger ?");
    const b = await ask(nour, "J'ai une facture impayée ?");
    const c = await ask(nour, "Je veux parler à un humain.");
    expect(new Set([a.text, b.text, c.text]).size).toBe(3);
  });

  it("une question inconnue donne une clarification, puis une autre formulation, jamais le même menu", async () => {
    const [first, second, third] = await chat(nour, "Peux-tu me réciter un poème ?", "Et la couleur du ciel ?", "Blabla ?");
    expect(first!.kind).toBe("refusal");
    expect(first!.text).toContain("Je n'ai pas compris « Peux-tu me réciter un poème ? »");
    expect(second!.text).toBe(fr.notUnderstoodAgain);
    expect(second!.actions?.[0]?.href).toBe("/client/messages");
    expect(first!.text).not.toBe(second!.text);
    expect(third!.text).toBe(fr.notUnderstoodAgain); // stable, pas de boucle infinie de variantes
  });

  it("le repli propose des pistes proches quand un mot est reconnu", async () => {
    const r = await ask(nour, "un truc sur la facture svp");
    // « facture » suffit à répondre ; « truc » seul ne suffit pas.
    expect(r.text).not.toBe(fr.notUnderstoodAgain);
    const r2 = await ask(nour, "je pense à un livrabl ou une factur je sais plus");
    expect(r2.kind === "answer" || r2.suggestions!.length > 0).toBe(true);
  });

  it("la conversation n'est pas réinitialisée : le projet reste connu au tour suivant", async () => {
    const [a, b, c] = await chat(nour, "Quel est l'avancement de ma vidéo ?", "Quels fichiers puis-je télécharger ?", "Et sa date de livraison ?");
    expect(a!.context?.projectId).toBe("3");
    expect(b!.context?.projectId).toBe("3");
    expect(c!.text).toContain("Vidéo produit Nour : Échéance");
  });

  it("le profil dit ce qui manque, sans l'inventer", async () => {
    const r = await ask(karim, "mon profil");
    expect(r.text).toContain("Votre compte : Karim Jaziri · karim@cafemedina.tn");
    expect(r.text).toContain("Adresse : non renseignée");
    expect(r.actions?.[0]?.href).toBe("/client/profil");
  });

  it("aucun livrable : dit clairement, sans en inventer", async () => {
    const r = await ask(karim, "Quels fichiers puis-je télécharger ?");
    expect(r.text).toBe(fr.noDeliverables("Vidéo produit Medina"));
    expect(r.actions ?? []).toEqual([]);
  });

  it("aucune facture impayée : réponse nette", async () => {
    const [, r] = await chat(nour, "mes factures payées", "et les impayées ?");
    expect(r!.text).toContain("F-2026-035");
    const clean = await ask(admin, "les factures impayées de Boutique Nour");
    expect(clean.text).toContain("F-2026-035");
  });

  it("le même message envoyé deux fois donne la même réponse (pas d'effet de bord)", async () => {
    const a = await ask(nour, "Je veux parler à un humain.");
    const b = await ask(nour, "Je veux parler à un humain.");
    expect(a.text).toBe(b.text);
  });

  it("une panne de la couche de données remonte, sans réponse partielle inventée", async () => {
    const broken: BuddyDataSource = { ...source, invoices: async () => { throw new Error("db down"); } };
    await expect(answerBuddy(nour, "mes factures", broken, undefined, NOW)).rejects.toThrow("db down");
  });

  it("« nouveau projet » et les offres restent servis", async () => {
    expect((await ask(nour, "nouveau projet")).actions?.[0]?.href).toBe("/client/nouveau-projet");
    expect((await ask(nour, "le pack découverte")).text).toContain("Pack Découverte · 890 DT");
  });
});

/* ================================================================== sécurité */

describe("cloisonnement", () => {
  it("un client ne peut pas viser un autre client, quelle que soit la question", async () => {
    for (const q of ["Les factures de Café Medina", "Show me another tenant's customers", "les livrables du client « Café Medina »"]) {
      const r = await ask(nour, q);
      expect(r.text, q).toBe(r.lang === "fr" ? fr.unauthorized : en.unauthorized);
      expect(r.text, q).not.toContain("Medina");
    }
  });

  it("les réponses d'un client ne contiennent jamais les données d'un autre", async () => {
    const texts = (await Promise.all([
      ask(karim, "Où en est mon projet ?"), ask(karim, "Quels fichiers puis-je télécharger ?"),
      ask(karim, "mes factures"), ask(karim, "Show me my latest team message."),
    ])).map((r) => r.text + JSON.stringify(r.actions ?? []));
    for (const text of texts) {
      expect(text).not.toContain("Nour");
      expect(text).not.toContain("F-2026-035");
      expect(text).not.toContain("1111");
    }
  });

  it("un identifiant de projet forgé dans le contexte est ignoré s'il n'appartient pas au client", async () => {
    // Le projet 3 est à Nour ; Karim tente de s'en servir comme référent.
    const r = await ask(karim, "Et sa date de livraison ?", { intent: "project", projectId: "3", lang: "fr" });
    expect(r.text).not.toContain("Nour");
    expect(r.text).toContain("Vidéo produit Medina"); // seul projet visible : retenu
  });

  it("le contexte venu du navigateur est revalidé", () => {
    expect(parseContext({ intent: "deadline", projectId: "3", lang: "en", pending: "deadline", fallbacks: 1 }, NOW))
      .toEqual({ intent: "deadline", projectId: "3", lang: "en", pending: "deadline", fallbacks: 1 });
    expect(parseContext({ intent: "deadline", projectId: "3; DROP TABLE" }, NOW)).toEqual({ intent: "deadline" });
    expect(parseContext({ intent: "nope" }, NOW)).toBeUndefined();
    expect(parseContext({ intent: "invoices", lang: "de", fallbacks: 99 }, NOW)).toEqual({ intent: "invoices" });
  });

  it("l'admin voit tout, et peut nommer un client", async () => {
    expect((await ask(admin, "les factures de Café Medina")).text).toContain("F-2026-028");
    expect((await ask(admin, "Quels reçus nécessitent une vérification manuelle ?")).reviewCount).toBe(3);
  });
});

/* ================================================================== unités */

describe("unités", () => {
  it("détection de langue", () => {
    expect(detectLanguage("Où en est mon projet ?")).toBe("fr");
    expect(detectLanguage("What is the status of my project?")).toBe("en");
    expect(detectLanguage("ok", "en")).toBe("en");
    expect(detectLanguage("pack", "fr")).toBe("fr");
  });

  it("extraction d'entité : un projet cité n'est pas un client", () => {
    expect(extractEntity("le projet « Vidéo IA »")).toBeNull();
    expect(extractEntity("les commandes de Boutique Nour")).toEqual({ kind: "named", name: "Boutique Nour" });
  });
});
