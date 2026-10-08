import Link from "next/link";
import { redirect } from "next/navigation";
import styles from "@/styles/neu.module.css";
import { clictopayConfigured } from "@/lib/clictopay";
import { formatDT } from "@/lib/format";
import { findPackByCode } from "@/server/services/orders";

export const dynamic = "force-dynamic";
export const metadata = { title: "Choisir un moyen de paiement" };

/**
 * Arrivée depuis « Finaliser la commande » du site vitrine : le visiteur choisit
 * comment régler. Carte → page de la banque tout de suite (compte créé après) ;
 * virement → création du compte, puis RIB et dépôt du justificatif.
 */
export default async function ChoisirPaiementPage({
  searchParams,
}: {
  searchParams: Promise<{ pack?: string }>;
}) {
  const { pack: code = "" } = await searchParams;
  if (!/^[A-Z0-9_]{2,40}$/.test(code)) redirect("/login");
  const pack = await findPackByCode(code).catch(() => null);
  if (!pack) redirect("/login");
  const cardAvailable = clictopayConfigured();

  return (
    <main className={styles.page}>
      <div className={styles.card} style={{ maxWidth: 480 }}>
        <div className={styles.badge} aria-hidden="true">🛒</div>
        <h1 className={styles.title}>Comment souhaitez-vous régler ?</h1>
        <p className={styles.subtitle}>Votre commande est validée dès confirmation du paiement.</p>

        <div className={styles.choice} style={{ marginTop: 18, cursor: "default", display: "block" }}>
          <p style={{ fontSize: 15, fontWeight: 800, color: "#26303f" }}>{pack.name}</p>
          <p style={{ marginTop: 6, fontSize: 22, fontWeight: 800, color: "#0a5ff0" }}>
            {formatDT(Number(pack.price))}
            {pack.isMonthly ? " / mois" : ""}
          </p>
        </div>

        <form action="/api/paiement/panier" method="POST" style={{ marginTop: 16 }}>
          <input type="hidden" name="pack" value={pack.code} />
          <button type="submit" className={styles.submit} style={{ width: "100%", marginTop: 0 }}>
            Payer par carte bancaire{cardAvailable ? "" : " (démonstration)"}
          </button>
        </form>
        <p className={styles.hint} style={{ marginTop: 6 }}>
          Page sécurisée de la banque · validation immédiate
        </p>

        <Link
          href={`/inscription?pack=${encodeURIComponent(pack.code)}&mode=virement`}
          className={styles.back}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 14 }}
        >
          Payer par virement bancaire
        </Link>
        <p className={styles.hint} style={{ marginTop: 6 }}>
          Vous créez votre compte, puis vous recevez le RIB et déposez votre justificatif.
        </p>

        <p className={styles.hint} style={{ marginTop: 16, fontSize: 11.5 }}>
          Déjà client ?{" "}
          <Link href={`/login?pack=${encodeURIComponent(pack.code)}`} style={{ color: "#0a5ff0", fontWeight: 600 }}>
            Connectez-vous
          </Link>{" "}
          : la commande s&apos;ajoute à votre espace.
        </p>
      </div>
    </main>
  );
}
