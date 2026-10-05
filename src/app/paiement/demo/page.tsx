import Link from "next/link";
import { redirect } from "next/navigation";
import styles from "@/styles/neu.module.css";
import { clictopayConfigured } from "@/lib/clictopay";
import { formatDT } from "@/lib/format";
import { findPackByCode } from "@/server/services/orders";

export const dynamic = "force-dynamic";
export const metadata = { title: "Paiement — démonstration" };

/**
 * Écran de paiement SIMULÉ, affiché à la place de la page de carte de la
 * banque tant que la passerelle ClicToPay n'est pas configurée.
 *
 * Il ne demande aucune carte et n'encaisse rien : « accepté » enregistre la
 * commande EN ATTENTE de règlement (voir /api/paiement/demo), exactement
 * comme avant. Une simulation ne doit jamais produire une commande payée —
 * cette page est publique.
 */
export default async function PaiementDemoPage({
  searchParams,
}: {
  searchParams: Promise<{ pack?: string }>;
}) {
  const { pack: code = "" } = await searchParams;
  if (!/^[A-Z0-9_]{2,40}$/.test(code)) redirect("/login");
  // Dès que la banque est branchée, cet écran n'a plus lieu d'être.
  if (clictopayConfigured()) redirect(`/api/paiement/panier?pack=${encodeURIComponent(code)}`);

  const pack = await findPackByCode(code).catch(() => null);
  if (!pack) redirect("/login");

  return (
    <main className={styles.page}>
      <div className={styles.card} style={{ maxWidth: 460 }}>
        <div className={styles.badge} aria-hidden="true">💳</div>
        <h1 className={styles.title}>Paiement par carte</h1>
        <p className={styles.subtitle}>Page de paiement sécurisée — mode démonstration</p>

        <div className={styles.choice} style={{ marginTop: 18, cursor: "default", display: "block" }}>
          <p style={{ fontSize: 15, fontWeight: 800, color: "#26303f" }}>{pack.name}</p>
          <p style={{ marginTop: 6, fontSize: 22, fontWeight: 800, color: "#0a5ff0" }}>
            {formatDT(Number(pack.price))}
            {pack.isMonthly ? " / mois" : ""}
          </p>
        </div>

        <p
          role="note"
          style={{
            marginTop: 14,
            padding: "10px 12px",
            borderRadius: 12,
            background: "#fff7e6",
            color: "#8a5a00",
            fontSize: 12.5,
            lineHeight: 1.5,
            fontWeight: 600,
          }}
        >
          Démonstration : le paiement en ligne n&apos;est pas encore ouvert. Aucune carte n&apos;est
          demandée et aucun montant n&apos;est débité.
        </p>

        <form action="/api/paiement/demo" method="POST">
          <input type="hidden" name="pack" value={pack.code} />
          <button type="submit" className={styles.submit} style={{ marginTop: 16 }}>
            Simuler un paiement accepté
          </button>
        </form>
        <Link
          href="/paiement/echec?motif=demo"
          className={styles.back}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 12 }}
        >
          Simuler un paiement refusé
        </Link>
      </div>
    </main>
  );
}
