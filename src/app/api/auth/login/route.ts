import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { verifyLogin } from "@/lib/auth";
import { createSession } from "@/lib/session";

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

  return NextResponse.json({ redirect: result.user.role === "ADMIN" ? "/admin" : "/client" });
}
