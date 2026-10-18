import { redirect } from "next/navigation";
import { headers } from "next/headers";
import styles from "@/styles/neu.module.css";
import { ctxOrNull, ValidationError } from "@/server/context";
import { moneticoAvailable, moneticoFormForOrder, moneticoFormForPack } from "@/server/services/monetico";
import { requestIsTunisian } from "@/lib/region";
import { formatMoney, formatDT } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Paiement par carte" };

/**
 * Passerelle vers la page de paiement Monetico (Crédit Mutuel), pour les
 * clients hors Tunisie : le formulaire scellé est posté automatiquement.
 * `?commande=ID` depuis l'espace client, `?pack=CODE` depuis le panier.
 */
export default async function CartePage({ searchParams }: { searchParams: Promise<{ commande?: string; pack?: string; engagement?: string }> }) {
  const { commande, pack, engagement } = await searchParams;
  if (!moneticoAvailable()) redirect(pack ? `/paiement/choisir?pack=${encodeURIComponent(pack)}` : "/paiement");

  let form;
  try {
    if (pack) {
      if (!/^[A-Z0-9_]{2,40}$/.test(pack)) redirect("/login");
      const h = await headers();
      if (requestIsTunisian(h)) redirect(`/paiement/choisir?pack=${encodeURIComponent(pack)}`);
      form = await moneticoFormForPack(pack, h.get("cf-ipcountry") ?? h.get("x-vercel-ip-country"), Number(engagement) || 1);
    } else {
      const ctx = await ctxOrNull("CLIENT");
      if (!ctx) redirect("/login?next=%2Fpaiement");
      const orderId = commande && /^\d{1,18}$/.test(commande) ? BigInt(commande) : undefined;
      form = await moneticoFormForOrder(ctx, orderId);
    }
  } catch (e) {
    if (e instanceof ValidationError) redirect("/paiement");
    throw e;
  }

  return (
    <main className={styles.page}>
      <div className={styles.card} style={{ maxWidth: 440 }}>
        <div className={styles.badge} aria-hidden="true">💳</div>
        <h1 className={styles.title}>Vers le paiement sécurisé</h1>
        <p className={styles.subtitle}>
          {form.label} — {formatMoney(form.amountEur, form.currency ?? "EUR", { decimals: 2 })}
        </p>
        <p className={styles.hint} style={{ marginTop: 12 }}>
          Vous allez être redirigé vers la page de paiement de notre banque (Monetico — Crédit Mutuel). Si rien ne se passe, cliquez sur le bouton.
        </p>
        <form id="monetico" action={form.action} method="POST" style={{ marginTop: 16 }}>
          {Object.entries(form.fields).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <button type="submit" className={styles.submit} style={{ width: "100%", marginTop: 0 }}>
            Continuer vers le paiement
          </button>
        </form>
        <script dangerouslySetInnerHTML={{ __html: "setTimeout(function(){var f=document.getElementById('monetico');if(f)f.submit();},400);" }} />
      </div>
    </main>
  );
}
