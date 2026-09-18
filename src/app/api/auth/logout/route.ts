import { NextResponse, type NextRequest } from "next/server";
import { destroySession } from "@/lib/session";

export async function POST(_req: NextRequest) {
  await destroySession();
  // Relative Location header: the browser stays on the host it used (IP, domain,
  // or localhost). An absolute URL built from req.url would send everyone to
  // whatever address the server believes it has — e.g. localhost behind a proxy.
  return new NextResponse(null, { status: 303, headers: { Location: "/login" } });
}

/**
 * Déconnexion par simple navigation, utilisée quand le serveur constate qu'une
 * session n'a plus lieu d'être — compte bloqué par un administrateur. Le motif
 * n'est repris que s'il fait partie des valeurs connues, pour ne pas laisser
 * l'URL dicter le message affiché.
 */
const MOTIFS = new Set(["compte_bloque"]);

export async function GET(req: NextRequest) {
  await destroySession();
  const motif = req.nextUrl.searchParams.get("motif");
  const suffix = motif && MOTIFS.has(motif) ? `?error=${motif}` : "";
  return new NextResponse(null, { status: 303, headers: { Location: `/login${suffix}` } });
}
