import Link from "next/link";
import styles from "@/styles/neu.module.css";

export const metadata = { title: "Paiement non abouti" };

// Le motif n'est repris que s'il fait partie des valeurs connues, pour ne pas
// laisser l'URL dicter le message affiché.
const MESSAGES: Record<string, { title: string; text: string }> = {
  en_cours: {
    title: "Paiement en cours de vérification",
    text: "Nous n'avons pas encore reçu la confirmation de la banque. Si votre carte a été débitée, votre commande sera validée automatiquement : inutile de payer une seconde fois.",
  },
  indisponible: {
    title: "Paiement en ligne indisponible",
    text: "La banque ne répond pas pour le moment. Réessayez dans quelques minutes ou contactez l'équipe.",
  },
};
const DEFAULT = {
  title: "Paiement non abouti",
  text: "Votre paiement a été refusé ou annulé. Aucun montant n'a été débité. Vous pouvez réessayer depuis votre espace.",
};

export default async function PaiementEchecPage({
  searchParams,
}: {
  searchParams: Promise<{ motif?: string }>;
}) {
  const { motif } = await searchParams;
  const message = (motif && MESSAGES[motif]) || DEFAULT;
  return (
    <main className={styles.page}>
      <div className={styles.card} style={{ maxWidth: 460 }}>
        <div className={styles.badge} aria-hidden="true">⚠️</div>
        <h1 className={styles.title}>{message.title}</h1>
        <p className={styles.subtitle}>{message.text}</p>
        <p className={styles.hint} style={{ marginTop: 14 }}>
          Besoin d&apos;aide ? contact@levelupia.agency
        </p>
        <Link href="/client" className={styles.back} style={{ display: "block", marginTop: 18, textAlign: "center" }}>
          Retour à mon espace
        </Link>
      </div>
    </main>
  );
}
