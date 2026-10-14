import { describe, expect, it } from "vitest";
import { MAIN_NEEDS } from "@/lib/onboardingOptions";
import { NEED_SPECS, PACK_NEEDS, needsForPacks } from "@/lib/needs";

describe("besoins proposés selon le pack commandé", () => {
  it("chaque besoin d'un pack existe dans la liste et a son sous-formulaire", () => {
    const known = new Set(MAIN_NEEDS.map((o) => o.value));
    for (const needs of Object.values(PACK_NEEDS)) for (const n of needs) {
      expect(known.has(n)).toBe(true);
      expect(NEED_SPECS[n]).toBeDefined();
    }
  });
  it("le Pack Découverte n'ouvre que le site web et le site marchand", () => {
    expect(needsForPacks(["PACK_DECOUVERTE"])).toEqual(["SITE_WEB", "SITE_MARCHAND"]);
  });
  it("plusieurs packs : union sans doublon ; pack inconnu ou aucun : pas de restriction", () => {
    expect(needsForPacks(["IDENTITE_EXPRESS", "SEO_STARTER", "PACK_LANCEMENT"])).toEqual(["IDENTITE", "SITE_WEB", "SHOOTING", "VIDEOS"]);
    expect(needsForPacks([])).toBeNull();
    expect(needsForPacks(["INCONNU"])).toBeNull();
  });
});
