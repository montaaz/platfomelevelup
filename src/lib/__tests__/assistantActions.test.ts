import { describe, expect, it } from "vitest";
import { detectProposal, isConfirmation, isDenial, matchProduct } from "@/lib/assistantActions";

const products = [
  { code: "PACK_DECOUVERTE", name: "Pack Découverte", price: 890, isMonthly: false, position: 1 },
  { code: "PACK_LANCEMENT", name: "Pack Lancement", price: 1890, isMonthly: false, position: 2 },
  { code: "ABO_STARTER", name: "Abonnement Starter", price: 1190, isMonthly: true, position: 5 },
  { code: "SEO_STARTER", name: "SEO Starter", price: 99, isMonthly: false, position: 11 },
  { code: "SEO_BUSINESS", name: "SEO Business", price: 290, isMonthly: false, position: 12 },
  { code: "IDENTITE_EXPRESS", name: "Identité visuelle express", price: 149, isMonthly: false, position: 9 },
];
const projects = [{ id: "7", title: "Site vitrine Boutique Nour" }];

describe("actions proposées par l'assistant", () => {
  it("reconnaît l'offre désignée, même sans accents, et préfère le nom le plus précis", () => {
    expect(matchProduct("ajoute seo starter au panier", products)?.code).toBe("SEO_STARTER");
    expect(matchProduct("je veux l'abonnement starter", products)?.code).toBe("ABO_STARTER");
    expect(matchProduct("mets moi l identite visuelle dans le panier", products)?.code).toBe("IDENTITE_EXPRESS");
    expect(matchProduct("je prends le pack 2", products)?.code).toBe("PACK_LANCEMENT");
    expect(matchProduct("bonjour", products)).toBeNull();
  });

  it("propose l'ajout au panier (jamais exécuté sans confirmation)", () => {
    const d = detectProposal("Ajoute SEO Business à mon panier s'il te plaît", products, projects);
    expect(d?.kind).toBe("proposal");
    if (d?.kind === "proposal") {
      expect(d.proposal.action).toBe("ADD_TO_CART");
      expect(d.proposal.summary).toContain("290 DT");
    }
  });

  it("propose un message à l'équipe sur l'unique projet du client", () => {
    const d = detectProposal("Dis à l'équipe que je veux un logo plus sombre", products, projects);
    expect(d?.kind).toBe("proposal");
    if (d?.kind === "proposal" && d.proposal.action === "SEND_MESSAGE") {
      expect(d.proposal.projectId).toBe("7");
      expect(d.proposal.body).toContain("je veux un logo plus sombre");
    }
  });

  it("propose une demande de projet pour un devis", () => {
    const d = detectProposal("Je voudrais un devis pour une boutique en ligne de 200 produits", products, projects);
    expect(d?.kind).toBe("proposal");
    if (d?.kind === "proposal") expect(d.proposal.action).toBe("CREATE_REQUEST");
  });

  it("refuse ce qui relève de l'équipe : paiement, statut, remise, suppression, annulation", () => {
    for (const s of ["Valide mon paiement", "Change le statut de mon projet en livré", "Fais-moi une remise de 20 %", "Supprime ma commande", "Annule la commande", "approve my payment"]) {
      expect(detectProposal(s, products, projects)?.kind, s).toBe("admin-only");
    }
  });

  it("une simple question ne déclenche aucune action", () => {
    expect(detectProposal("Quel est le prix du SEO Starter ?", products, projects)).toBeNull();
    expect(detectProposal("Où en est mon projet ?", products, projects)).toBeNull();
  });

  it("reconnaît oui / non à l'oral", () => {
    expect(isConfirmation("Oui, vas-y")).toBe(true);
    expect(isConfirmation("d'accord")).toBe(true);
    expect(isConfirmation("non merci")).toBe(false);
    expect(isDenial("Non, annule")).toBe(true);
  });
});
