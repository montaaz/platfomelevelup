import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clictopayConfigured, fetchPaymentStatus, GatewayError, registerPayment, toMillimes } from "@/lib/clictopay";

const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });

describe("clictopay", () => {
  beforeEach(() => {
    vi.stubEnv("CLICTOPAY_USERNAME", "marchand");
    vi.stubEnv("CLICTOPAY_PASSWORD", "secret");
    vi.stubEnv("CLICTOPAY_BASE_URL", "https://test.clictopay.com/payment/rest");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("convertit les dinars en millimes sans erreur d'arrondi", () => {
    expect(toMillimes("1890.000")).toBe(1_890_000);
    expect(toMillimes(0.29)).toBe(290);
    expect(toMillimes("1059.100")).toBe(1_059_100);
  });

  it("n'est pas configuré sans identifiants", () => {
    vi.stubEnv("CLICTOPAY_PASSWORD", "");
    expect(clictopayConfigured()).toBe(false);
  });

  it("ouvre une transaction en TND et renvoie la page de la banque", async () => {
    const fetchMock = vi.fn(async () =>
      json({ orderId: "abc-123-def-456", formUrl: "https://test.clictopay.com/payment/merchants/x/payment_fr.html?mdOrder=abc" }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const out = await registerPayment({
      orderNumber: "LU7-x",
      amountMillimes: 890_000,
      returnUrl: "https://levelupia.app/api/paiement/retour",
      failUrl: "https://levelupia.app/api/paiement/echec",
    });
    expect(out.gatewayOrderId).toBe("abc-123-def-456");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { body: URLSearchParams }];
    expect(url).toBe("https://test.clictopay.com/payment/rest/register.do");
    expect(init.body.get("amount")).toBe("890000");
    expect(init.body.get("currency")).toBe("788");
  });

  it("refuse une page de paiement hébergée ailleurs que chez la banque", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ orderId: "abc-123-def-456", formUrl: "https://evil.example/pay" })));
    await expect(
      registerPayment({ orderNumber: "LU7-y", amountMillimes: 1, returnUrl: "https://a", failUrl: "https://b" }),
    ).rejects.toBeInstanceOf(GatewayError);
  });

  it("remonte l'erreur de la banque", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ errorCode: "5", errorMessage: "Accès refusé" })));
    await expect(
      registerPayment({ orderNumber: "LU7-z", amountMillimes: 1, returnUrl: "https://a", failUrl: "https://b" }),
    ).rejects.toThrow(/Accès refusé/);
  });

  it("ne considère payée qu'une transaction débitée", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json({ errorCode: "0", orderStatus: 2, orderNumber: "LU7-x", amount: 890000, currency: "788", cardAuthInfo: { approvalCode: "123456" } }),
      ),
    );
    expect(await fetchPaymentStatus("abc")).toMatchObject({ paid: true, declined: false, amountMillimes: 890000, approvalCode: "123456" });

    vi.stubGlobal("fetch", vi.fn(async () => json({ errorCode: "0", orderStatus: 6, amount: 890000, currency: "788" })));
    expect(await fetchPaymentStatus("abc")).toMatchObject({ paid: false, declined: true });

    vi.stubGlobal("fetch", vi.fn(async () => json({ errorCode: "0", orderStatus: 0, amount: 890000, currency: "788" })));
    expect(await fetchPaymentStatus("abc")).toMatchObject({ paid: false, declined: false });
  });
});
