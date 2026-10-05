import Link from "next/link";
import styles from "@/styles/neu.module.css";

export const metadata = { title: "Paiement accepté" };

/** Le client revient de la banque : sa commande vient d'être encaissée. */
export default function PaiementSuccesPage() {
  return (
    <main className={styles.page}>
      <div className={styles.card} style={{ maxWidth: 460 }}>
        <div className={styles.badge} aria-hidden="true">✅</div>
        <h1 className={styles.title}>Paiement accepté</h1>
        <p className={styles.subtitle}>
          Merci ! Votre règlement est confirmé. Votre facture est disponible dans votre espace et
          notre équipe démarre votre prestation.
        </p>
        <Link href="/client" className={styles.back} style={{ display: "block", marginTop: 18, textAlign: "center" }}>
          Accéder à mon espace
        </Link>
      </div>
    </main>
  );
}
