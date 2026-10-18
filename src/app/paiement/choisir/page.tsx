import Link from "next/link";
import { redirect } from "next/navigation";
import styles from "@/styles/neu.module.css";
import { headers } from "next/headers";
import { clictopayConfigured } from "@/lib/clictopay";
import { moneticoAvailable } from "@/server/services/monetico";
import { tndToEur } from "@/lib/monetico";
import { requestCurrency, requestIsTunisian } from "@/lib/region";
import { COMMITMENTS, commitmentAmount, commitmentFor } from "@/lib/commitment";
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
  searchParams: Promise<{ pack?: string; engagement?: string }>;
}) {
  const { pack: code = "", engagement: rawEngagement } = await searchParams;
  if (!/^[A-Z0-9_]{2,40}$/.test(code)) redirect("/login");
  const pack = await findPackByCode(code).catch(() => null);
  if (!pack) redirect("/login");
  const tunisian = requestIsTunisian(await headers());
  const devise = tunisian ? "TND" : requestCurrency(await headers());
  // Abonnement : promotions de la grille tarifaire (6 mois = 1 offert, 12 mois = 2 offerts).
  const engagement = pack.isMonthly ? commitmentFor(Number(rawEngagement) || 1) : commitmentFor(1);
  const total = commitmentAmount(Number(pack.price), engagement.months);
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
            {formatMoney(tunisian ? total : tndToEur(total), devise)}
            {pack.isMonthly ? (engagement.months > 1 ? ` pour ${engagement.months} mois` : " / mois") : ""}
          </p>
          {pack.isMonthly && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 12 }}>
              {COMMITMENTS.map((c) => {
                const on = c.months === engagement.months;
                return (
                  <Link key={c.months} href={`/paiement/choisir?pack=${encodeURIComponent(pack.code)}&engagement=${c.months}`} aria-current={on ? "true" : undefined}
                    style={{ borderRadius: 14, padding: "10px 6px", textAlign: "center", textDecoration: "none", border: on ? "2px solid #0a5ff0" : "1px solid #d9dfeb", background: on ? "#eef3ff" : "#fff" }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 800, color: "#26303f" }}>{c.label}</span>
                    {c.promo && <span style={{ display: "inline-block", marginTop: 4, padding: "2px 7px", borderRadius: 999, background: "#e6f7ee", color: "#0a8f4e", fontSize: 10.5, fontWeight: 800 }}>{c.promo}</span>}
                    <span style={{ display: "block", marginTop: 4, fontSize: 11.5, color: "#6b7689" }}>{formatMoney(commitmentAmount(Number(pack.price), c.months), devise)}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {pack.code === "PACK_DECOUVERTE" && (
          <div className={styles.choice} style={{ marginTop: 14, cursor: "default", display: "block", textAlign: "left", background: "#f3f6fb" }}>
            <p style={{ fontSize: 13.5, fontWeight: 800, color: "#26303f" }}>Vous voulez un site marchand ?</p>
            <p style={{ marginTop: 4, fontSize: 12.5, color: "#6b7689", lineHeight: 1.5 }}>
              Il est réalisé sur devis : créez votre compte, décrivez votre boutique et réservez un échange de 30 minutes. L&apos;équipe vous envoie ensuite votre devis. <b>Aucun paiement maintenant.</b>
            </p>
            <Link href={`/inscription?pack=${encodeURIComponent(pack.code)}&devis=1`} className={styles.back} style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 10, height: 44, textDecoration: "none" }}>
              Demander un devis pour un site marchand
            </Link>
          </div>
        )}
        {pack.code === "PACK_DECOUVERTE" && (
          <p className={styles.hint} style={{ marginTop: 14, fontWeight: 700 }}>Site vitrine (5 à 6 pages) : réglez maintenant</p>
        )}

        {cardProvider === "monetico" && (
          <>
            <Link href={`/paiement/carte?pack=${encodeURIComponent(pack.code)}${pack.isMonthly ? `&engagement=${engagement.months}` : ""}`} className={styles.submit} style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 16, textDecoration: "none" }}>
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
            Pour la Tunisie, le règlement se fait par <strong>virement bancaire</strong> : vous créez votre compte, le RIB s&apos;affiche à copier, puis vous cliquez sur « J&apos;ai fait le virement ». Votre projet démarre dès que l&apos;équipe constate le virement.
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
          Vous créez votre compte, puis le RIB s&apos;affiche à copier ; un clic sur « J&apos;ai fait le virement » prévient l&apos;équipe.
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
