import { NextResponse, type NextRequest } from "next/server";
import { rememberPrepaidPayment } from "@/lib/session";
import { afterPaidLocation } from "@/server/prepaidClaim";
import { moneticoReturnLocation } from "@/server/services/monetico";

const to = (location: string) => new NextResponse(null, { status: 303, headers: { Location: location } });

/** Retour du client depuis la page Monetico. L'encaissement a eu lieu (ou aura lieu) par la notification serveur. */
export async function GET(req: NextRequest) {
  const reference = req.nextUrl.searchParams.get("ref") ?? "";
  const ok = req.nextUrl.searchParams.get("ok") === "1";
  try {
    const r = await moneticoReturnLocation(reference, ok);
    if (r.prepaid) {
      await rememberPrepaidPayment(r.prepaid.id);
      return to(await afterPaidLocation({ outcome: "PAID", prepaid: r.prepaid }));
    }
    return to(r.location);
  } catch (e) {
    console.error("[monetico] retour:", e);
    return to("/paiement/echec?motif=en_cours");
  }
}
