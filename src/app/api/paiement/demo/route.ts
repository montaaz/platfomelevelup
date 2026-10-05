import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { clictopayConfigured } from "@/lib/clictopay";
import { ctxOrNull } from "@/server/context";
import { createOrderForClient, findPackByCode } from "@/server/services/orders";

const to = (location: string) => new NextResponse(null, { status: 303, headers: { Location: location } });

/**
 * « Simuler un paiement accepté » de l'écran de démonstration.
 *
 * Rien n'est encaissé : la commande est enregistrée EN ATTENTE de règlement,
 * comme pour une commande classique. Un client déjà connecté la retrouve tout
 * de suite dans son espace ; un visiteur passe d'abord par l'inscription, qui
 * la crée à partir de l'offre portée par le lien.
 */
export async function POST(req: NextRequest) {
  const raw = (await req.formData().catch(() => null))?.get("pack");
  const code = typeof raw === "string" ? raw : "";
  if (!/^[A-Z0-9_]{2,40}$/.test(code)) return to("/login");
  // La simulation n'existe que tant que la banque n'est pas branchée.
  if (clictopayConfigured()) return to(`/api/paiement/panier?pack=${encodeURIComponent(code)}`);

  const ctx = await ctxOrNull("CLIENT");
  if (!ctx?.clientId) return to(`/inscription?pack=${encodeURIComponent(code)}&demo=1`);

  try {
    const pack = await findPackByCode(code);
    // Un second clic ne doit pas créer une seconde commande pour la même offre.
    const existing = await prisma.order.findFirst({
      where: { clientId: ctx.clientId, packId: pack.id, status: "EN_ATTENTE_PAIEMENT" },
      select: { id: true },
    });
    if (!existing) await createOrderForClient(ctx.clientId, pack.code);
    return to("/paiement/succes?demo=1");
  } catch (e) {
    console.error("[paiement] démonstration:", e);
    return to("/paiement/echec?motif=indisponible");
  }
}
