import { NextResponse, type NextRequest } from "next/server";
import { afterPaidLocation } from "@/server/prepaidClaim";
import { resolveGatewayReturn } from "@/server/services/prepaid";

const to = (location: string) => new NextResponse(null, { status: 303, headers: { Location: location } });

/**
 * URL de retour quand le paiement est refusé ou qu'un problème a eu lieu.
 * On relit tout de même la banque : si la carte a finalement été débitée, le
 * client ne doit pas voir un écran d'échec.
 */
export async function GET(req: NextRequest) {
  const gatewayOrderId = req.nextUrl.searchParams.get("orderId") ?? "";
  try {
    const result = await resolveGatewayReturn(gatewayOrderId);
    if (result.outcome === "PAID") return to(await afterPaidLocation(result));
  } catch (e) {
    console.error("[paiement] échec:", e);
  }
  return to("/paiement/echec");
}
