import { redirect } from "next/navigation";
import styles from "@/styles/neu.module.css";
import { requireCtx } from "@/server/context";
import { myAccessState } from "@/server/services/orders";
import { formatDT } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Écran d'attente de paiement. Tant que l'admin (ou plus tard la banque) n'a
 * pas confirmé l'encaissement, le client ne peut pas entrer dans la plateforme.
 */
export default async function PaiementPage() {
  const ctx = await requireCtx("CLIENT");
  const access = await myAccessState(ctx);
  if (access.accessGranted) redirect("/client");

  const order = access.pendingOrder;

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
            Le paiement en ligne arrive bientôt. En attendant, réglez par virement ou contactez
            l&apos;équipe : votre accès est ouvert dès réception.
          </p>
          <p style={{ marginTop: 8, fontSize: 12.5, fontWeight: 600, color: "#0a5ff0" }}>
            contact@levelupia.tn
          </p>
        </div>

        <form action="/api/auth/logout" method="POST" style={{ marginTop: 18 }}>
          <button type="submit" className={styles.back} style={{ width: "100%" }}>
            Se déconnecter
          </button>
        </form>
      </div>
    </main>
  );
}
