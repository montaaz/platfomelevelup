import Link from "next/link";
import { primaryBtnCls } from "@/components/Modal";
import { clictopayConfigured } from "@/lib/clictopay";

/**
 * Bouton « Payer » d'une commande en attente. Avec la passerelle bancaire
 * configurée, il envoie le client sur la page de carte de la banque ; sinon il
 * mène à l'écran qui explique comment régler (virement, contact).
 */
export function PayOrderButton({ orderId, small = false }: { orderId: string; small?: boolean }) {
  const cls = `${primaryBtnCls} inline-block whitespace-nowrap ${small ? "!px-3.5 !py-1.5 !text-[12.5px]" : ""}`;
  if (!clictopayConfigured()) {
    return (
      <Link href={`/paiement?commande=${orderId}`} className={cls}>
        Payer
      </Link>
    );
  }
  return (
    <form action="/api/paiement/demarrer" method="POST">
      <input type="hidden" name="orderId" value={orderId} />
      <button type="submit" className={cls}>
        Payer par carte
      </button>
    </form>
  );
}
