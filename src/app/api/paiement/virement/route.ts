import { NextResponse, type NextRequest } from "next/server";
import { ctxOrNull, ValidationError } from "@/server/context";
import { submitTransferProof } from "@/server/services/transfers";

/** Dépôt du justificatif de virement (formulaire multipart de la page /paiement). */
export async function POST(req: NextRequest) {
  const ctx = await ctxOrNull("CLIENT");
  if (!ctx) return NextResponse.json({ error: "Session expirée." }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const orderRaw = form?.get("orderId");
  const file = form?.get("file");
  const reference = form?.get("reference");
  if (typeof orderRaw !== "string" || !/^\d{1,18}$/.test(orderRaw) || !(file instanceof File)) {
    return NextResponse.json({ error: "Formulaire incomplet." }, { status: 400 });
  }
  try {
    const proof = await submitTransferProof(ctx, BigInt(orderRaw), file, typeof reference === "string" ? reference : null);
    return NextResponse.json({ proof });
  } catch (e) {
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("[virement] dépôt:", e);
    return NextResponse.json({ error: "Envoi impossible. Réessayez." }, { status: 500 });
  }
}
