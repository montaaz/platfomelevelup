import { NextResponse, type NextRequest } from "next/server";
import { afterPaidLocation } from "@/server/prepaidClaim";
import { resolveGatewayReturn } from "@/server/services/prepaid";

const to = (location: string) => new NextResponse(null, { status: 303, headers: { Location: location } });

/**
 * URL de retour quand la banque annonce un paiement accepté. L'annonce n'est
 * pas crue sur parole : le résultat est redemandé à la banque avant d'encaisser.
 */
export async function GET(req: NextRequest) {
  const gatewayOrderId = req.nextUrl.searchParams.get("orderId") ?? "";
  try {
    const result = await resolveGatewayReturn(gatewayOrderId);
    if (result.outcome === "PAID") return to(await afterPaidLocation(result));
    if (result.outcome === "PENDING") return to("/paiement/echec?motif=en_cours");
    return to("/paiement/echec");
  } catch (e) {
    console.error("[paiement] retour:", e);
    // La banque n'a pas pu être relue : sa notification réglera la commande.
    return to("/paiement/echec?motif=en_cours");
  }
}
