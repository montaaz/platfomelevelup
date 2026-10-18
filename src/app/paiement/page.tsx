import { redirect } from "next/navigation";
import Link from "next/link";
import styles from "@/styles/neu.module.css";
import { ctxOrNull } from "@/server/context";
import { myAccessState, myPendingOrders } from "@/server/services/orders";
import { latestProofsByOrder } from "@/server/services/transfers";
import { formatDT, formatMoney } from "@/lib/format";
import { clictopayConfigured } from "@/lib/clictopay";
import { moneticoAvailable } from "@/server/services/monetico";
import { clientIsTunisian } from "@/lib/region";
import { prisma } from "@/lib/prisma";
import { BANK_ACCOUNT, transferLabel } from "@/lib/bank";
import { TransferPayment } from "@/components/client/TransferPayment";
import { EngagementPicker } from "@/components/client/EngagementPicker";

export const dynamic = "force-dynamic";

/**
 * Règlement d'une commande : le client choisit entre la carte bancaire (page
 * sécurisée de la banque) et le virement (RIB à copier + justificatif à
 * déposer, validé par l'équipe). Même page pour toutes les commandes en attente.
 */
export default async function PaiementPage({
  searchParams,
}: {
  searchParams: Promise<{ commande?: string }>;
}) {
  const ctx = await ctxOrNull("CLIENT");
  if (!ctx) redirect("/api/auth/logout?motif=compte_bloque");
  const [access, pendingOrders, { commande }] = await Promise.all([
    myAccessState(ctx),
    myPendingOrders(ctx),
    searchParams,
  ]);
  // La commande désignée par le bouton « Payer », sinon la plus récente.
  const order = pendingOrders.find((o) => o.id === commande) ?? pendingOrders[0] ?? null;
  // Plateforme fermée tant qu'aucune commande n'est payée (voir app/client/layout).
  const paidCount = await prisma.order.count({ where: { clientId: ctx.clientId!, status: "PAYEE" } });
  const blocked = pendingOrders.length > 0 && paidCount === 0;
  if (!order && access.accessGranted) redirect("/client");
  const proofs = order ? await latestProofsByOrder([BigInt(order.id)]) : new Map();
  const proof = order ? (proofs.get(order.id) ?? null) : null;
  const client = await prisma.client.findUnique({ where: { id: ctx.clientId! }, select: { country: true, detectedCountryCode: true } });
  const tunisian = clientIsTunisian(client ?? {});
  // Tunisie : carte en dinars (ClicToPay) quand la banque l'ouvrira ; ailleurs : carte en euros (Monetico).
  const cardProvider = tunisian ? (clictopayConfigured() ? "clictopay" : null) : moneticoAvailable() ? "monetico" : null;
  const cardAvailable = cardProvider !== null;

  return (
    <main className={styles.page} style={{ alignItems: "flex-start", paddingTop: 36, paddingBottom: 48 }}>
      <div className={styles.card} style={{ maxWidth: 520 }}>
        <div className={styles.badge} aria-hidden="true">💳</div>
        <h1 className={styles.title}>Régler ma commande</h1>
        <p className={styles.subtitle}>
          Choisissez votre moyen de paiement. Votre prestation démarre dès que le règlement est confirmé.
        </p>

        {order ? (
          <>
            <div className={styles.choice} style={{ marginTop: 18, cursor: "default", display: "block" }}>
              <p style={{ fontSize: 15, fontWeight: 800, color: "#26303f" }}>{order.packName}</p>
              <p style={{ marginTop: 6, fontSize: 22, fontWeight: 800, color: "#0a5ff0" }}>
                {formatMoney(order.amount, order.currency)}
                {order.isMonthly ? (order.commitmentMonths > 1 ? ` pour ${order.commitmentMonths} mois` : " / mois") : ""}
              </p>
              {order.isMonthly && (
                <EngagementPicker orderId={order.id} monthly={order.monthlyPrice} currency={order.currency} current={order.commitmentMonths} />
              )}
              {pendingOrders.length > 1 && (
                <p className={styles.hint} style={{ marginTop: 8 }}>
                  Autres commandes en attente :{" "}
                  {pendingOrders
                    .filter((o) => o.id !== order.id)
                    .map((o) => (
                      <Link key={o.id} href={`/paiement?commande=${o.id}`} style={{ color: "#0a5ff0", fontWeight: 600, marginRight: 8 }}>
                        {o.packName}
                      </Link>
                    ))}
                </p>
              )}
            </div>

            {/* ------------------------------------------------ carte bancaire (hors Tunisie, ou ClicToPay quand ouvert) */}
            {(cardAvailable || !tunisian) && (
              <div className={styles.choice} style={{ marginTop: 14, cursor: "default", display: "block", textAlign: "left" }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#26303f" }}>Carte bancaire</p>
                <p style={{ marginTop: 4, fontSize: 12.5, color: "#6b7689", fontWeight: 400, lineHeight: 1.5 }}>
                  {cardProvider === "monetico"
                    ? "Paiement immédiat sur la page sécurisée de notre banque (Monetico — Crédit Mutuel). Votre commande est validée tout de suite."
                    : cardProvider === "clictopay"
                      ? "Paiement immédiat sur la page sécurisée de la banque (ClicToPay). Votre commande est validée tout de suite."
                      : "Le paiement par carte sera bientôt disponible. En attendant, réglez par virement ci-dessous."}
                </p>
                {cardProvider === "monetico" && (
                  <Link href={`/paiement/carte?commande=${order.id}`} className={styles.submit} style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 12, height: 48, textDecoration: "none" }}>
                    Payer par carte
                  </Link>
                )}
                {cardProvider === "clictopay" && (
                  <form action="/api/paiement/demarrer" method="POST" style={{ marginTop: 12 }}>
                    <input type="hidden" name="orderId" value={order.id} />
                    <button type="submit" className={styles.submit} style={{ width: "100%", marginTop: 0, height: 48 }}>
                      Payer par carte
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* ------------------------------------------------ virement */}
            <TransferPayment
              orderId={order.id}
              amount={`${formatMoney(order.amount, order.currency)}${order.isMonthly ? (order.commitmentMonths > 1 ? ` (${order.commitmentMonths} mois)` : " / mois") : ""}`}
              label={transferLabel(order.id)}
              bank={BANK_ACCOUNT}
              proof={proof}
            />
          </>
        ) : (
          <p className={styles.hint} style={{ marginTop: 18 }}>
            Aucune commande en attente. Contactez l&apos;équipe pour ouvrir votre accès.
          </p>
        )}

        <p className={styles.hint} style={{ marginTop: 14 }}>
          Une question ? contact@levelupia.agency
        </p>

        {blocked && (
          <p role="status" style={{ marginTop: 16, padding: "10px 12px", borderRadius: 12, background: "#eef3ff", color: "#1c3f8a", fontSize: 12.5, fontWeight: 600, lineHeight: 1.5 }}>
            🔒 Votre espace Level Up AI s&apos;ouvre dès que l&apos;équipe confirme votre paiement. Vous recevez alors une notification par e-mail.
          </p>
        )}

        {access.accessGranted && !blocked ? (
          <Link
            href="/client"
            className={styles.back}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 18 }}
          >
            Retour à mon espace
          </Link>
        ) : (
          <form action="/api/auth/logout" method="POST" style={{ marginTop: 18 }}>
            <button type="submit" className={styles.back} style={{ width: "100%" }}>
              Se déconnecter
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
