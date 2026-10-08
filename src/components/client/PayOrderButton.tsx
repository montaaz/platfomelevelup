import Link from "next/link";
import { primaryBtnCls } from "@/components/Modal";

/**
 * Bouton « Payer » d'une commande en attente : mène à la page de règlement,
 * où le client choisit entre carte bancaire et virement (RIB + justificatif).
 */
export function PayOrderButton({ orderId, small = false }: { orderId: string; small?: boolean }) {
  const cls = `${primaryBtnCls} inline-block whitespace-nowrap ${small ? "!px-3.5 !py-1.5 !text-[12.5px]" : ""}`;
  return (
    <Link href={`/paiement?commande=${orderId}`} className={cls}>
      Payer
    </Link>
  );
}
