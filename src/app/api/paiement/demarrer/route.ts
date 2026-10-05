import { NextResponse, type NextRequest } from "next/server";
import { ctxOrNull, ValidationError } from "@/server/context";
import { startOnlinePayment } from "@/server/services/orders";
import { GatewayError } from "@/lib/clictopay";

const to = (location: string) => new NextResponse(null, { status: 303, headers: { Location: location } });

/**
 * « Payer par carte » : ouvre la transaction chez la banque et y envoie le
 * client. Le formulaire ne transmet que le numéro de la commande — son
 * appartenance au client et son montant sont relus en base.
 */
export async function POST(req: NextRequest) {
  const ctx = await ctxOrNull("CLIENT");
  if (!ctx) return to("/login?next=%2Fpaiement");
  try {
    const raw = (await req.formData().catch(() => null))?.get("orderId");
    const orderId = typeof raw === "string" && /^\d{1,18}$/.test(raw) ? BigInt(raw) : undefined;
    return to(await startOnlinePayment(ctx, orderId));
  } catch (e) {
    if (e instanceof ValidationError) return to("/client");
    if (!(e instanceof GatewayError)) console.error("[paiement] démarrage:", e);
    else console.warn("[paiement] démarrage:", e.message);
    return to("/paiement/echec?motif=indisponible");
  }
}
