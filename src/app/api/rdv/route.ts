import { NextResponse, type NextRequest } from "next/server";
import { ctxOrNull, ValidationError } from "@/server/context";
import { bookAppointment, cancelMyAppointment } from "@/server/services/appointments";

export async function POST(req: NextRequest) {
  const ctx = await ctxOrNull("CLIENT");
  if (!ctx) return NextResponse.json({ error: "Session expirée." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { start?: unknown; need?: unknown } | null;
  if (typeof body?.start !== "string") return NextResponse.json({ error: "Créneau manquant." }, { status: 400 });
  try {
    return NextResponse.json(await bookAppointment(ctx, body.start, typeof body.need === "string" ? body.need : null));
  } catch (e) {
    if (e instanceof ValidationError) return NextResponse.json({ error: e.message }, { status: 409 });
    console.error("[rdv]", e);
    return NextResponse.json({ error: "Réservation impossible." }, { status: 500 });
  }
}

export async function DELETE() {
  const ctx = await ctxOrNull("CLIENT");
  if (!ctx) return NextResponse.json({ error: "Session expirée." }, { status: 401 });
  await cancelMyAppointment(ctx);
  return NextResponse.json({ ok: true });
}
