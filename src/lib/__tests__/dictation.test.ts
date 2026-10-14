import { describe, expect, it } from "vitest";
import { acceptCorrection, appendDictation, correctionPrompt, tidyTranscript } from "@/lib/dictation";

describe("dictée vocale", () => {
  it("retire hésitations et répétitions", () => {
    expect(tidyTranscript("euh je veux  un site site vitrine , hum pour ma boutique")).toBe("je veux un site vitrine, pour ma boutique");
  });

  it("accepte une vraie correction et refuse une réponse ou une réécriture", () => {
    const o = "je veu un site vitrine avec 5 pages pour ma boutique de vetement";
    expect(acceptCorrection(o, "Je veux un site vitrine avec 5 pages pour ma boutique de vêtements.")).toBe(true);
    expect(acceptCorrection(o, "VIDE")).toBe(false);
    expect(acceptCorrection(o, "Je suis l'assistant de Level Up IA, je peux vous aider à créer un site vitrine.")).toBe(false);
    expect(acceptCorrection(o, "Je veux un site vitrine avec 6 pages pour ma boutique de vêtements.")).toBe(false); // chiffre changé
    expect(acceptCorrection(o, "Site.")).toBe(false); // trop court
  });

  it("ajoute la dictée à la suite du texte existant", () => {
    expect(appendDictation("", "Bonjour tout le monde")).toBe("Bonjour tout le monde");
    expect(appendDictation("Produits de beauté.", "Crèmes et parfums")).toBe("Produits de beauté. Crèmes et parfums");
    expect(appendDictation("Produits de beauté", "Crèmes et parfums")).toBe("Produits de beauté, crèmes et parfums");
  });

  it("la consigne interdit toute réponse et tout ajout", () => {
    const p = correctionPrompt("Quels produits souhaitez-vous présenter ?", "fr");
    expect(p).toContain("uniquement par le texte corrigé");
    expect(p).toContain("Quels produits");
  });
});
