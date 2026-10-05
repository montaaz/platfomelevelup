import { NextResponse, type NextRequest } from "next/server";
import { finalizeGatewayPayment } from "@/server/services/orders";

const to = (location: string) => new NextResponse(null, { status: 303, headers: { Location: location } });

/**
 * URL de retour quand le paiement est refusé ou qu'un problème a eu lieu.
 * On relit tout de même la banque : si la carte a finalement été débitée, le
 * client ne doit pas voir un écran d'échec.
 */
export async function GET(req: NextRequest) {
  const gatewayOrderId = req.nextUrl.searchParams.get("orderId") ?? "";
  try {
    if ((await finalizeGatewayPayment(gatewayOrderId)) === "PAID") return to("/paiement/succes");
  } catch (e) {
    console.error("[paiement] échec:", e);
  }
  return to("/paiement/echec");
}
