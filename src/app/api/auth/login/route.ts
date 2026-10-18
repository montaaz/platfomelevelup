import { homeFor } from "@/server/context";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { verifyLogin } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { recordDetectedCountry } from "@/server/services/geo";
import { claimPrepaidFromCookie } from "@/server/prepaidClaim";
import { readChosenPack, forgetChosenPack } from "@/lib/session";
import { ensurePendingOrder, findPackByCode } from "@/server/services/orders";

const LoginInput = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const parsed = LoginInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "E-mail ou mot de passe invalide." }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const result = await verifyLogin(parsed.data.email, parsed.data.password, ip);

  if (!result.ok) {
    const message =
      result.reason === "LOCKED"
        ? "Compte temporairement verrouillé après trop de tentatives. Réessayez dans quelques minutes."
        : "E-mail ou mot de passe incorrect.";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  await createSession({
    userId: result.user.id.toString(),
    role: result.user.role,
    clientId: result.user.clientId?.toString() ?? null,
    fullName: result.user.fullName,
    email: result.user.email,
  });

  // Paiement fait depuis le panier du site vitrine avant de se connecter :
  // il devient une commande payée de ce client.
  const prepaid = await claimPrepaidFromCookie(result.user.clientId);
  // Client existant arrivé du panier du site vitrine : l'offre choisie devient sa commande.
  const chosen = await readChosenPack();
  if (!prepaid && chosen && result.user.clientId) {
    try {
      const pack = await findPackByCode(chosen);
      await ensurePendingOrder(BigInt(result.user.clientId), pack.code);
    } catch (e) {
      console.error("[login] commande non créée:", e);
    }
  }
  await forgetChosenPack();

  // Provenance relevée à chaque connexion : le client qui déménage est suivi.
  if (result.user.clientId) {
    await recordDetectedCountry(result.user.clientId, req.headers, result.user.id);
  }

  return NextResponse.json({ redirect: homeFor(result.user.role) });
}
