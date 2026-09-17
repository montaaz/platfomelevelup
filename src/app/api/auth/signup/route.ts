import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { signupClient } from "@/server/services/signup";
import { createSession } from "@/lib/session";
import { ValidationError } from "@/server/context";

const SignupInput = z.object({
  fullName: z.string().min(1).max(160),
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
  confirmPassword: z.string().min(1).max(200),
});

/** Anti-abus : au plus 5 inscriptions par IP et par heure (mémoire du process). */
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const attempts = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    attempts.set(ip, recent);
    return true;
  }
  recent.push(now);
  attempts.set(ip, recent);
  if (attempts.size > 5000) attempts.clear(); // garde-fou mémoire
  return false;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "inconnue";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez dans une heure." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const parsed = SignupInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Merci de remplir tous les champs correctement." }, { status: 400 });
  }

  try {
    const user = await signupClient(parsed.data);
    // connexion immédiate après inscription
    await createSession({
      userId: user.id,
      role: user.role,
      clientId: user.clientId,
      fullName: user.fullName,
      email: user.email,
    });
    return NextResponse.json({ redirect: "/client" });
  } catch (e) {
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("[signup]", e);
    return NextResponse.json({ error: "Création impossible. Réessayez." }, { status: 500 });
  }
}
