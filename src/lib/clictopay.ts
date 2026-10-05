/**
 * Passerelle de paiement ClicToPay (SMT — Attijari E-Payment).
 *
 * Deux appels suffisent, tous deux de serveur à serveur :
 *   - `register.do` ouvre une transaction et renvoie la page de saisie de carte
 *     hébergée par la banque (aucun numéro de carte ne passe par la plateforme) ;
 *   - `getOrderStatusExtended.do` dit ce que la banque a réellement décidé.
 *
 * Règle de sécurité : on ne croit JAMAIS les paramètres de l'URL de retour ni
 * ceux de l'URL de notification. Ils ne servent qu'à savoir QUELLE transaction
 * relire ; le résultat est toujours redemandé à la banque avec nos identifiants.
 */

const TEST_BASE = "https://test.clictopay.com/payment/rest";

/** Code ISO 4217 du dinar tunisien, seule devise encaissée. */
export const TND_NUMERIC = "788";

/** `orderStatus` renvoyé par la banque quand la carte a bien été débitée. */
const STATUS_DEPOSITED = 2;

const TIMEOUT_MS = 15_000;

function config() {
  const userName = process.env.CLICTOPAY_USERNAME;
  const password = process.env.CLICTOPAY_PASSWORD;
  if (!userName || !password) return null;
  const base = (process.env.CLICTOPAY_BASE_URL || TEST_BASE).replace(/\/+$/, "");
  return { userName, password, base };
}

/** Sans identifiants marchands, le bouton « Payer par carte » n'est pas proposé. */
export function clictopayConfigured(): boolean {
  return config() !== null;
}

export class GatewayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GatewayError";
  }
}

/** Le dinar compte 3 décimales : la banque attend un entier en millimes. */
export function toMillimes(amount: number | string): number {
  return Math.round(Number(amount) * 1000);
}

async function call(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const cfg = config();
  if (!cfg) throw new GatewayError("Paiement en ligne non configuré.");

  const body = new URLSearchParams({ userName: cfg.userName, password: cfg.password, ...params });
  let res: Response;
  try {
    res = await fetch(`${cfg.base}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    throw new GatewayError("La banque ne répond pas.");
  }
  if (!res.ok) throw new GatewayError(`La banque a répondu ${res.status}.`);
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    throw new GatewayError("Réponse de la banque illisible.");
  }
}

/** La banque signale une erreur par un `errorCode` différent de 0. */
function errorOf(data: Record<string, unknown>): string | null {
  const code = String(data.errorCode ?? data.ErrorCode ?? "0");
  if (code === "0") return null;
  return String(data.errorMessage ?? data.ErrorMessage ?? `erreur ${code}`);
}

/**
 * Ouvre une transaction. `orderNumber` doit être unique chez la banque : une
 * nouvelle tentative pour la même commande porte donc un nouveau numéro.
 */
export async function registerPayment(input: {
  orderNumber: string;
  amountMillimes: number;
  returnUrl: string;
  failUrl: string;
  description?: string;
}): Promise<{ gatewayOrderId: string; formUrl: string }> {
  const cfg = config();
  const data = await call("register.do", {
    orderNumber: input.orderNumber,
    amount: String(input.amountMillimes),
    currency: TND_NUMERIC,
    returnUrl: input.returnUrl,
    failUrl: input.failUrl,
    language: "fr",
    ...(input.description ? { description: input.description.slice(0, 99) } : {}),
  });
  const error = errorOf(data);
  if (error) throw new GatewayError(`Ouverture du paiement refusée : ${error}`);

  const gatewayOrderId = typeof data.orderId === "string" ? data.orderId : "";
  const formUrl = typeof data.formUrl === "string" ? data.formUrl : "";
  if (!gatewayOrderId || !formUrl) throw new GatewayError("Réponse de la banque incomplète.");

  // Le client va être redirigé vers cette adresse : elle doit rester chez la banque.
  let sameHost = false;
  try {
    sameHost = new URL(formUrl).host === new URL(cfg!.base).host;
  } catch {
    sameHost = false;
  }
  if (!sameHost) throw new GatewayError("Adresse de paiement inattendue.");

  return { gatewayOrderId, formUrl };
}

export type GatewayStatus = {
  paid: boolean;
  /** Refus définitif (carte refusée, délai dépassé…), par opposition à « pas encore payé ». */
  declined: boolean;
  orderNumber: string;
  amountMillimes: number;
  currency: string;
  approvalCode: string | null;
  detail: string | null;
};

/** Relit le résultat d'une transaction auprès de la banque. */
export async function fetchPaymentStatus(gatewayOrderId: string): Promise<GatewayStatus> {
  const data = await call("getOrderStatusExtended.do", { orderId: gatewayOrderId, language: "fr" });
  const error = errorOf(data);
  if (error) throw new GatewayError(`Statut du paiement indisponible : ${error}`);

  const status = Number(data.orderStatus ?? data.OrderStatus);
  const card = (data.cardAuthInfo ?? {}) as Record<string, unknown>;
  return {
    paid: status === STATUS_DEPOSITED,
    // 3 = annulée, 4 = remboursée, 6 = autorisation refusée
    declined: status === 3 || status === 4 || status === 6,
    orderNumber: String(data.orderNumber ?? data.OrderNumber ?? ""),
    amountMillimes: Number(data.amount ?? data.Amount ?? NaN),
    currency: String(data.currency ?? data.Currency ?? ""),
    approvalCode: typeof card.approvalCode === "string" ? card.approvalCode : null,
    detail: typeof data.actionCodeDescription === "string" ? data.actionCodeDescription : null,
  };
}
