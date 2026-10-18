import { describe, expect, it } from "vitest";
import { commitmentAmount, commitmentFor } from "@/lib/commitment";

describe("promotions des abonnements", () => {
  it("6 mois : 1 offert, 12 mois : 2 offerts", () => {
    expect(commitmentAmount(1190, 1)).toBe(1190);
    expect(commitmentAmount(1190, 6)).toBe(5950);
    expect(commitmentAmount(1190, 12)).toBe(11900);
    expect(commitmentAmount(290, 12)).toBe(2900);
  });
  it("une durée inconnue retombe sur le mensuel", () => {
    expect(commitmentFor(3).months).toBe(1);
    expect(commitmentAmount(1490, 7)).toBe(1490);
  });
});
