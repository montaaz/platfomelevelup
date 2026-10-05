import { describe, expect, it } from "vitest";
import { answerBuddy } from "../answer";
import { jsonDataSource, type Fixtures } from "../data/json";
import fixtures from "../data/fixtures.json";
import { checkAnswer, numbersIn } from "../ai/guard";
import { readAIConfig, type ChatMessage, type ChatOptions, type LocalModel } from "../ai/model";
import { publicKnowledge, retrieve } from "../ai/knowledge";
import { L } from "../locales";
import type { BuddyCtx } from "../data/types";

/**
 * Le modèle local est remplacé par un faux : on vérifie ce que l'assistant
 * lui envoie (cloisonnement), ce qu'il fait de ses réponses (contrôle des
 * chiffres, repli) — sans Ollama, de façon déterministe.
 */
const NOW = new Date("2026-09-21T12:00:00Z");
const source = jsonDataSource(fixtures as Fixtures, () => NOW);
const nour: BuddyCtx = { userId: 10n, role: "CLIENT", clientId: 1n, fullName: "Nour Ben Salah" };
const admin: BuddyCtx = { userId: 1n, role: "ADMIN", clientId: null, fullName: "Sarra Dhaouadi" };

type Call = { messages: ChatMessage[]; opts: ChatOptions };

/** Faux modèle : `label` pour le classement (appel JSON), `reply` pour la rédaction. */
function fakeModel(label: string | Error, reply: string | Error = "INCONNU"): LocalModel & { calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    async chat(messages, opts) {
      calls.push({ messages, opts });
      const out = opts.json ? label : reply;
      if (out instanceof Error) throw out;
      return opts.json ? JSON.stringify({ label: out }) : out;
    },
    async embed() {
      return null;
    },
  };
}

const ask = (ctx: BuddyCtx, q: string, model: LocalModel | null) => answerBuddy(ctx, q, source, undefined, NOW, undefined, model);
const system = (c: Call) => c.messages.find((m) => m.role === "system")!.content;

describe("configuration du modèle local", () => {
  it("désactivé par défaut", () => {
    expect(readAIConfig({})).toBeNull();
  });
  it("refuse une adresse qui n'est pas sur ce serveur", () => {
    expect(readAIConfig({ BUDDY_AI: "on", OLLAMA_URL: "https://api.example.com" })).toBeNull();
    expect(readAIConfig({ BUDDY_AI: "on", OLLAMA_URL: "http://10.0.0.5:11434" })).toBeNull();
  });
  it("accepte la boucle locale, modèles par défaut", () => {
    expect(readAIConfig({ BUDDY_AI: "on" })).toEqual({ url: "http://127.0.0.1:11434", chatModel: "qwen2.5:3b", embedModel: "bge-m3" });
    expect(readAIConfig({ BUDDY_AI: "on", BUDDY_EMBED_MODEL: "off" })?.embedModel).toBeNull();
  });
});

describe("contrôle des réponses du modèle", () => {
  it("reconnaît un montant quel que soit le séparateur de milliers", () => {
    expect(numbersIn("1 890 DT")).toEqual(numbersIn("1 890 DT"));
    expect(numbersIn("15/10/2026")).toEqual(new Set(["15", "10", "2026"]));
  });
  it("accepte une réponse dont les chiffres viennent des sources", () => {
    const r = checkAnswer("Le **Pack Découverte** coûte 890 DT.", "Pack Découverte : 890 DT.", "fr");
    expect(r).toEqual({ ok: true, text: "Le Pack Découverte coûte 890 DT." });
  });
  it("rejette un prix inventé", () => {
    expect(checkAnswer("Le Pack Découverte coûte 450 DT.", "Pack Découverte : 890 DT.", "fr").ok).toBe(false);
  });
  it("rejette un lieu ou un nom inventé, accepte ceux des sources", () => {
    expect(checkAnswer("LevelUp AI est basé à Tunis.", "Agence de marketing digital par IA.", "fr").ok).toBe(false);
    expect(checkAnswer("Oui, nous créons des publicités pour Instagram et le Pack Lancement.", "Pack Lancement : vidéos. Publicités Instagram.", "fr").ok).toBe(true);
  });
  it("rejette « je ne sais pas », un lien inconnu, la mauvaise langue", () => {
    expect(checkAnswer("INCONNU", "x", "fr").ok).toBe(false);
    expect(checkAnswer("Payez sur https://pay.example.com aujourd'hui.", "Paiement par virement.", "fr").ok).toBe(false);
    expect(checkAnswer("Votre projet est en cours et l'équipe travaille dessus.", "", "en").ok).toBe(false);
  });
});

describe("recherche dans les connaissances", () => {
  it("trouve le pack qui parle de shooting", async () => {
    const t = L("fr");
    const chunks = publicKnowledge(await source.products(), "fr", t.money);
    const hits = await retrieve("je veux un shooting photo pour mes produits", chunks, 3);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.map((c) => c.text).join(" ")).toMatch(/shooting/i);
  });
});

describe("détection d'un autre client", () => {
  it("une plateforme ou une langue n'est pas un nom de client", async () => {
    const { extractEntity } = await import("../entity");
    expect(extractEntity("vous faites du montage vidéo pour TikTok ?")).toBeNull();
    expect(extractEntity("des visuels pour Instagram et Facebook")).toBeNull();
    expect(extractEntity("traduire mes vidéos en Anglais pour France")).toBeNull();
    expect(extractEntity("les factures de Café Medina")).toEqual({ kind: "named", name: "Café Medina" });
  });
});

describe("assistant avec modèle local", () => {
  it("sans modèle, rien ne change : repli habituel", async () => {
    const r = await ask(nour, "Est-ce que vous travaillez avec les restaurants ?", null);
    expect(r.kind).toBe("refusal");
    expect(r.ai).toBeUndefined();
  });

  it("le modèle classe une question non comprise → réponse du gabarit, lue en base", async () => {
    const model = fakeModel("invoices");
    const r = await ask(nour, "Est-ce que vous travaillez avec les restaurants ?", model);
    expect(r.context?.intent).toBe("invoices");
    expect(r.text).toContain("F-2026-031");
    expect(r.ai).toBeUndefined();
    expect(model.calls).toHaveLength(1);
  });

  it("question générale : réponse rédigée, validée, marquée IA, avec accès à l'équipe", async () => {
    const model = fakeModel("question", "Oui, nous créons des sites web et des vidéos pour tous les business, restaurants compris.");
    const r = await ask(nour, "Est-ce que vous travaillez avec les restaurants ?", model);
    expect(r.kind).toBe("answer");
    expect(r.ai).toBe(true);
    expect(r.actions).toEqual([{ label: L("fr").actions.messages, href: "/client/messages" }]);
    // Question générale : aucune donnée du compte n'est envoyée au modèle.
    expect(system(model.calls[1]!)).not.toContain("Site e-commerce Nour");
  });

  it("réponse avec un chiffre inventé → écartée, repli habituel", async () => {
    const model = fakeModel("question", "Oui, un site pour restaurant coûte 450 DT.");
    const r = await ask(nour, "Est-ce que vous travaillez avec les restaurants ?", model);
    expect(r.kind).toBe("refusal");
    expect(r.ai).toBeUndefined();
  });

  it("étiquette hors liste, panne ou délai dépassé → repli habituel", async () => {
    for (const model of [fakeModel("hack_the_db"), fakeModel(new Error("timeout")), fakeModel("question", new Error("down"))]) {
      const r = await ask(nour, "Est-ce que vous travaillez avec les restaurants ?", model);
      expect(r.kind).toBe("refusal");
    }
  });

  it("question hors sujet → pas de rédaction", async () => {
    const model = fakeModel("off_topic", "Voici un poème.");
    const r = await ask(nour, "écris-moi un poème", model);
    expect(r.kind).toBe("refusal");
    expect(model.calls).toHaveLength(1);
  });

  it("question sur le compte : le modèle ne reçoit que les données de ce client", async () => {
    const model = fakeModel("account_question");
    await ask(nour, "Do you work with hotels?", model);
    const facts = system(model.calls[1]!);
    expect(facts).toContain("Site e-commerce Nour");
    expect(facts).toContain("Vidéo produit Nour");
    expect(facts).not.toMatch(/Medina|Karim|Café/);
  });

  it("un client ne peut pas être orienté vers une intention réservée à l'équipe", async () => {
    const model = fakeModel("review");
    const r = await ask(nour, "Est-ce que vous travaillez avec les restaurants ?", model);
    expect(r.kind).toBe("refusal");
    expect(system(model.calls[0]!)).not.toContain("review:");
  });

  it("administrateur : seulement les compteurs de l'agence, aucun détail client", async () => {
    const model = fakeModel("account_question");
    await ask(admin, "Do you work with hotels?", model);
    const facts = system(model.calls[1]!);
    expect(facts).toContain("Projects in progress");
    expect(facts).not.toMatch(/Site e-commerce Nour|Medina/);
  });

  it("« quel pack pour un restaurant ? » : le modèle départage, puis conseille à partir des offres", async () => {
    const model = fakeModel("offers", "Le Pack Découverte à 890 DT est une bonne première étape pour une nouvelle marque.");
    const r = await ask(nour, "quel pack pour un restaurant ?", model);
    expect(r.ai).toBe(true);
    expect(r.text).toContain("890 DT");
    expect(system(model.calls[1]!)).toContain("Pack Découverte");
  });
});

describe("contrôle : réponses hors sujet ou contradictoires", () => {
  const src = "[Identité visuelle express] Logo et charte graphique générés rapidement pour les entreprises qui démarrent.";
  it("rejette un poème : ses mots ne viennent pas des sources", () => {
    expect(checkAnswer("Dans l'ombre du jour naissant, le vent murmure ses secrets à la plaine endormie.", src, "fr", "écris-moi un poème").ok).toBe(false);
  });
  it("rejette « non » quand les sources parlent du sujet demandé", () => {
    expect(checkAnswer("Non, nous ne faisons pas de logos.", src, "fr", "vous faites des logos ?").ok).toBe(false);
    expect(checkAnswer("Nous créons une identité visuelle express. Pas de logo directement.", src, "fr", "vous faites des logos ?").ok).toBe(false);
    expect(checkAnswer("Oui, nous créons logo et charte graphique rapidement.", src, "fr", "vous faites des logos ?").ok).toBe(true);
  });
  it("accepte un « non » quand les sources ne parlent pas du sujet", () => {
    expect(checkAnswer("Non, la charte graphique est générée rapidement mais pas les applications mobiles.", src, "fr", "vous faites des applications mobiles ?").ok).toBe(true);
  });
});
