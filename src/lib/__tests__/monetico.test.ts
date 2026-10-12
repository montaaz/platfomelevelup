import { describe, expect, it } from "vitest";
import { buildPaymentForm, computeMac, moneticoDate, readMoneticoConfig, readNotification, tndToEur, usableKey, type MoneticoConfig } from "@/lib/monetico";

const KEY = "0123456789ABCDEF0123456789ABCDEF01234567";
const CFG: MoneticoConfig = { tpe: "XZ85771", societe: "merchandis", key: KEY, url: "https://p.monetico-services.com/test/paiement.cgi", env: "test" };

describe("monetico", () => {
  it("lit la configuration et refuse une clé malformée", () => {
    expect(readMoneticoConfig({})).toBeNull();
    expect(readMoneticoConfig({ MONETICO_TPE: "XZ85771", MONETICO_SOCIETE: "merchandis", MONETICO_KEY: "trop-court" })).toBeNull();
    const c = readMoneticoConfig({ MONETICO_TPE: "XZ85771", MONETICO_SOCIETE: "merchandis", MONETICO_KEY: KEY, MONETICO_ENV: "prod" });
    expect(c?.url).toBe("https://p.monetico-services.com/paiement.cgi");
  });

  it("décode la clé comme le kit officiel (lettres G–Z en fin de clé)", () => {
    expect(usableKey(KEY).length).toBe(20);
    // « M » en 40e position : le 39e caractère est suivi d'un 0
    expect(usableKey(KEY.slice(0, 38) + "AM").toString("hex").endsWith("a0")).toBe(true);
    // lettre > F en 39e position : ramenée de 23 dans l'alphabet (« Z » → « C »)
    expect(usableKey(KEY.slice(0, 38) + "Z1").toString("hex").endsWith("c1")).toBe(true);
  });

  it("convertit les dinars en euros avec le taux configuré", () => {
    expect(tndToEur("890.000", { TND_EUR_RATE: "0.29" })).toBe(258.1);
    expect(tndToEur(1890, {})).toBe(1890);
  });

  it("scelle les champs triés et joints par *", () => {
    const mac = computeMac({ b: "2", a: "1", MAC: "ignored" }, KEY);
    expect(mac).toMatch(/^[0-9a-f]{40}$/);
    expect(mac).toBe(computeMac({ a: "1", b: "2" }, KEY));
    expect(mac).not.toBe(computeMac({ a: "1", b: "3" }, KEY));
  });

  it("construit un formulaire v3.0 complet", () => {
    const { action, fields } = buildPaymentForm(
      { reference: "O12-abc!def_ghij", amountEur: 258.1, email: "client@example.com", lang: "EN", urlRetourOk: "https://levelupia.app/ok", urlRetourErr: "https://levelupia.app/err", texteLibre: "order:12", billing: { country: "fr", city: "Paris" } },
      CFG,
    );
    expect(action).toBe(CFG.url);
    expect(fields.reference).toBe("O12abcdefghi");
    expect(fields.montant).toBe("258.10EUR");
    expect(fields.version).toBe("3.0");
    expect(fields.TPE).toBe("XZ85771");
    expect(JSON.parse(Buffer.from(fields.contexte_commande, "base64").toString("utf8")).billing.country).toBe("FR");
    expect(fields.MAC).toBe(computeMac(fields, KEY));
    expect(moneticoDate(new Date("2026-10-12T09:05:07Z"))).toMatch(/^12\/10\/2026:11:05:07$/);
  });

  it("accepte une notification bien scellée et refuse les autres", () => {
    const base: Record<string, string> = { TPE: "XZ85771", date: "12/10/2026:11:05:07", montant: "258.10EUR", reference: "O12abcdefghi", "code-retour": "payetest", numauto: "000123", "texte-libre": "order:12" };
    const signed = { ...base, MAC: computeMac(base, KEY) };
    const n = readNotification(signed, CFG);
    expect(n.valid && n.paid).toBe(true);
    expect(n.amountEur).toBe(258.1);
    expect(n.currency).toBe("EUR");
    expect(readNotification({ ...signed, montant: "999.00EUR" }, CFG).valid).toBe(false);
    expect(readNotification({ ...base, "code-retour": "Annulation", MAC: computeMac({ ...base, "code-retour": "Annulation" }, KEY) }, CFG).paid).toBe(false);
  });
});
