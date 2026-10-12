import Link from "next/link";
import { redirect } from "next/navigation";
import styles from "@/styles/neu.module.css";
import { headers } from "next/headers";
import { clictopayConfigured } from "@/lib/clictopay";
import { moneticoAvailable } from "@/server/services/monetico";
import { tndToEur } from "@/lib/monetico";
import { requestIsTunisian } from "@/lib/region";
import { formatDT, formatMoney } from "@/lib/format";
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
  const tunisian = requestIsTunisian(await headers());
  const cardProvider = tunisian ? (clictopayConfigured() ? "clictopay" : "demo") : moneticoAvailable() ? "monetico" : "demo";

  return (
    <main className={styles.page}>
      <div className={styles.card} style={{ maxWidth: 480 }}>
        <div className={styles.badge} aria-hidden="true">🛒</div>
        <h1 className={styles.title}>Comment souhaitez-vous régler ?</h1>
        <p className={styles.subtitle}>Votre commande est validée dès confirmation du paiement.</p>

        <div className={styles.choice} style={{ marginTop: 18, cursor: "default", display: "block" }}>
          <p style={{ fontSize: 15, fontWeight: 800, color: "#26303f" }}>{pack.name}</p>
          <p style={{ marginTop: 6, fontSize: 22, fontWeight: 800, color: "#0a5ff0" }}>
            {tunisian ? formatDT(Number(pack.price)) : formatMoney(tndToEur(Number(pack.price)), "EUR")}
            {pack.isMonthly ? " / mois" : ""}
          </p>
        </div>

        {cardProvider === "monetico" && (
          <>
            <Link href={`/paiement/carte?pack=${encodeURIComponent(pack.code)}`} className={styles.submit} style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 16, textDecoration: "none" }}>
              Payer par carte bancaire
            </Link>
            <p className={styles.hint} style={{ marginTop: 6 }}>Page sécurisée de notre banque (Monetico — Crédit Mutuel) · validation immédiate</p>
          </>
        )}
        {cardProvider !== "monetico" && !tunisian && (
          <>
            <form action="/api/paiement/panier" method="POST" style={{ marginTop: 16 }}>
              <input type="hidden" name="pack" value={pack.code} />
              <button type="submit" className={styles.submit} style={{ width: "100%", marginTop: 0 }}>
                Payer par carte bancaire{cardProvider === "demo" ? " (démonstration)" : ""}
              </button>
            </form>
            <p className={styles.hint} style={{ marginTop: 6 }}>Page sécurisée de la banque · validation immédiate</p>
          </>
        )}
        {tunisian && cardProvider === "clictopay" && (
          <>
            <form action="/api/paiement/panier" method="POST" style={{ marginTop: 16 }}>
              <input type="hidden" name="pack" value={pack.code} />
              <button type="submit" className={styles.submit} style={{ width: "100%", marginTop: 0 }}>Payer par carte bancaire</button>
            </form>
            <p className={styles.hint} style={{ marginTop: 6 }}>Page sécurisée de la banque · validation immédiate</p>
          </>
        )}
        {tunisian && cardProvider === "demo" && (
          <p className={styles.hint} style={{ marginTop: 14, lineHeight: 1.5 }}>
            Pour la Tunisie, le règlement se fait par <strong>virement bancaire</strong> : vous créez votre compte, le RIB s&apos;affiche à copier, puis vous déposez votre justificatif. Votre projet démarre dès que l&apos;équipe constate le virement.
          </p>
        )}

        <Link
          href={`/inscription?pack=${encodeURIComponent(pack.code)}&mode=virement`}
          className={styles.back}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 14 }}
        >
          {tunisian ? "Continuer — payer par virement" : "Payer par virement bancaire"}
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
