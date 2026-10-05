import { NextResponse, type NextRequest } from "next/server";
import { resolveGatewayReturn } from "@/server/services/prepaid";

/**
 * URL de notification : la banque l'appelle de serveur à serveur dès qu'une
 * autorisation est accordée, même si le client a fermé son navigateur avant
 * de revenir sur le site. L'adresse est publique, donc son contenu ne sert
 * qu'à savoir quelle transaction relire auprès de la banque.
 */
async function handle(gatewayOrderId: string) {
  try {
    await resolveGatewayReturn(gatewayOrderId);
    return new NextResponse("OK", { status: 200 });
  } catch (e) {
    console.error("[paiement] notification:", e);
    // 5xx : la banque renverra la notification plus tard.
    return new NextResponse("ERREUR", { status: 503 });
  }
}

const idFrom = (params: URLSearchParams) => params.get("mdOrder") ?? params.get("orderId") ?? "";

export async function GET(req: NextRequest) {
  return handle(idFrom(req.nextUrl.searchParams));
}

export async function POST(req: NextRequest) {
  let id = idFrom(req.nextUrl.searchParams);
  if (!id) {
    const body = await req.text().catch(() => "");
    id = idFrom(new URLSearchParams(body));
  }
  return handle(id);
}
