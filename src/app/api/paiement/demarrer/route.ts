import { NextResponse } from "next/server";
import { ctxOrNull, ValidationError } from "@/server/context";
import { startOnlinePayment } from "@/server/services/orders";
import { GatewayError } from "@/lib/clictopay";

const to = (location: string) => new NextResponse(null, { status: 303, headers: { Location: location } });

/**
 * « Payer par carte » : ouvre la transaction chez la banque et y envoie le
 * client. Le formulaire ne transmet rien — la commande et son montant sont
 * relus en base à partir de la session.
 */
export async function POST() {
  const ctx = await ctxOrNull("CLIENT");
  if (!ctx) return to("/login?next=%2Fpaiement");
  try {
    return to(await startOnlinePayment(ctx));
  } catch (e) {
    if (e instanceof ValidationError) return to("/client");
    if (!(e instanceof GatewayError)) console.error("[paiement] démarrage:", e);
    else console.warn("[paiement] démarrage:", e.message);
    return to("/paiement/echec?motif=indisponible");
  }
}
