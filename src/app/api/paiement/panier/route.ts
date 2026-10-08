import { NextResponse, type NextRequest } from "next/server";
import { clictopayConfigured, GatewayError } from "@/lib/clictopay";
import { ValidationError } from "@/server/context";
import { startPrepaidPayment } from "@/server/services/prepaid";

const to = (location: string) => new NextResponse(null, { status: 303, headers: { Location: location } });

/** Anti-abus : chaque appel ouvre une transaction chez la banque (mémoire du process). */
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 20;
const attempts = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  const limited = recent.length >= MAX_PER_WINDOW;
  if (!limited) recent.push(now);
  attempts.set(ip, recent);
  if (attempts.size > 5000) attempts.clear(); // garde-fou mémoire
  return limited;
}

/**
 * « Finaliser la commande » du panier du site vitrine : le visiteur arrive ici
 * avec un code d'offre et choisit son moyen de paiement (carte ou virement).
 */
export async function GET(req: NextRequest) {
  const pack = req.nextUrl.searchParams.get("pack") ?? "";
  if (!/^[A-Z0-9_]{2,40}$/.test(pack)) return to("/login");
  return to(`/paiement/choisir?pack=${encodeURIComponent(pack)}`);
}

/**
 * Carte bancaire choisie : départ direct sur la page de carte de la banque.
 * Le compte se crée APRÈS le paiement (voir services/prepaid).
 *
 * Tant que la passerelle bancaire n'est pas configurée, le visiteur voit un
 * écran de paiement simulé (aucune carte, aucun débit — voir /paiement/demo).
 * Si elle est configurée mais ne répond pas, on retombe sur l'ancien parcours :
 * connexion puis paiement dans l'espace.
 */
export async function POST(req: NextRequest) {
  const raw = (await req.formData().catch(() => null))?.get("pack");
  const pack = typeof raw === "string" ? raw : "";
  if (!/^[A-Z0-9_]{2,40}$/.test(pack)) return to("/login");
  const fallback = `/login?pack=${encodeURIComponent(pack)}`;
  if (!clictopayConfigured()) return to(`/paiement/demo?pack=${encodeURIComponent(pack)}`);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "inconnue";
  if (rateLimited(ip)) return to(fallback);

  try {
    return to(await startPrepaidPayment(pack));
  } catch (e) {
    if (e instanceof ValidationError) return to("/login");
    if (e instanceof GatewayError) console.warn("[paiement] panier:", e.message);
    else console.error("[paiement] panier:", e);
    return to(fallback);
  }
}
