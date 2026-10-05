import Link from "next/link";
import styles from "@/styles/neu.module.css";

export const metadata = { title: "Paiement accepté" };

/** Le client revient de la banque : sa commande vient d'être encaissée. */
export default async function PaiementSuccesPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const demo = (await searchParams).demo === "1";
  return (
    <main className={styles.page}>
      <div className={styles.card} style={{ maxWidth: 460 }}>
        <div className={styles.badge} aria-hidden="true">✅</div>
        <h1 className={styles.title}>{demo ? "Commande enregistrée" : "Paiement accepté"}</h1>
        <p className={styles.subtitle}>
          {demo
            ? "Démonstration : aucun montant n'a été débité. Votre commande est dans votre espace, en attente de règlement."
            : "Merci ! Votre règlement est confirmé. Votre facture est disponible dans votre espace et notre équipe démarre votre prestation."}
        </p>
        <Link
          href="/client"
          className={styles.back}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 18 }}
        >
          Accéder à mon espace
        </Link>
      </div>
    </main>
  );
}
