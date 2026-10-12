import { NextResponse, type NextRequest } from "next/server";
import { handleMoneticoNotification } from "@/server/services/monetico";
import { NOTIFICATION_KO, NOTIFICATION_OK } from "@/lib/monetico";

/**
 * « Interface retour » Monetico : appelée par la banque, serveur à serveur,
 * à chaque paiement (POST, champs de formulaire). La réponse textuelle
 * « cdr=0 » accuse réception ; « cdr=1 » fait réessayer Monetico.
 */
async function handle(req: NextRequest) {
  const fields: Record<string, string> = {};
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    form?.forEach((v, k) => { if (typeof v === "string") fields[k] = v; });
  } else {
    req.nextUrl.searchParams.forEach((v, k) => { fields[k] = v; });
  }
  try {
    const result = await handleMoneticoNotification(fields);
    return new NextResponse(result === "INVALID" ? NOTIFICATION_KO : NOTIFICATION_OK, { status: 200, headers: { "Content-Type": "text/plain" } });
  } catch (e) {
    console.error("[monetico] notification:", e);
    return new NextResponse(NOTIFICATION_KO, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
}
export const POST = handle;
export const GET = handle;
