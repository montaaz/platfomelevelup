import { redirect } from "next/navigation";
import styles from "@/styles/neu.module.css";
import { ctxOrNull } from "@/server/context";
import Link from "next/link";
import { myAccessState, myPendingOrders } from "@/server/services/orders";
import { formatDT } from "@/lib/format";
import { clictopayConfigured } from "@/lib/clictopay";

export const dynamic = "force-dynamic";

/**
 * Écran d'attente de paiement. Tant que l'admin ou la banque n'a
 * pas confirmé l'encaissement, le client ne peut pas entrer dans la plateforme.
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
  if (!order && access.accessGranted) redirect("/client");
  const payOnline = order != null && clictopayConfigured();

  return (
    <main className={styles.page}>
      <div className={styles.card} style={{ maxWidth: 460 }}>
        <div className={styles.badge} aria-hidden="true">⏳</div>
        <h1 className={styles.title}>Paiement en attente</h1>
        <p className={styles.subtitle}>
          Votre compte est créé. L&apos;accès s&apos;ouvre dès que votre paiement est confirmé.
        </p>

        {order ? (
          <div
            className={styles.choice}
            style={{ marginTop: 18, cursor: "default", display: "block" }}
          >
            <p style={{ fontSize: 15, fontWeight: 800, color: "#26303f" }}>{order.packName}</p>
            <p style={{ marginTop: 6, fontSize: 22, fontWeight: 800, color: "#0a5ff0" }}>
              {formatDT(order.amount)}
              {order.isMonthly ? " / mois" : ""}
            </p>
          </div>
        ) : (
          <p className={styles.hint} style={{ marginTop: 18 }}>
            Aucune commande en attente. Contactez l&apos;équipe pour ouvrir votre accès.
          </p>
        )}

        <div
          className={styles.choice}
          style={{ marginTop: 14, cursor: "default", display: "block", lineHeight: 1.55 }}
        >
          <p style={{ fontSize: 13, fontWeight: 700, color: "#26303f" }}>Comment régler ?</p>
          <p style={{ marginTop: 6, fontSize: 12.5, color: "#6b7689", fontWeight: 400 }}>
            {payOnline
              ? "Payez par carte bancaire sur la page sécurisée de la banque, ou réglez par virement en contactant l'équipe : votre accès est ouvert dès réception."
              : "Réglez par virement ou contactez l'équipe : votre accès est ouvert dès réception."}
          </p>
          <p style={{ marginTop: 8, fontSize: 12.5, fontWeight: 600, color: "#0a5ff0" }}>
            contact@levelupia.agency
          </p>
        </div>

        {payOnline && (
          <form action="/api/paiement/demarrer" method="POST" style={{ marginTop: 14 }}>
            <input type="hidden" name="orderId" value={order.id} />
            <button type="submit" className={styles.submit} style={{ width: "100%" }}>
              Payer par carte
            </button>
          </form>
        )}

        {access.accessGranted ? (
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
