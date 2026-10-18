import { NextResponse } from "next/server";
import { ctxOrNull } from "@/server/context";
import { availableSlots, myNextAppointment } from "@/server/services/appointments";

/** Créneaux libres (15 jours) et rendez-vous à venir du client connecté. */
export async function GET() {
  const ctx = await ctxOrNull("CLIENT");
  if (!ctx) return NextResponse.json({ error: "Session expirée." }, { status: 401 });
  const [slots, mine] = await Promise.all([availableSlots(), myNextAppointment(ctx)]);
  return NextResponse.json({ slots, mine }, { headers: { "Cache-Control": "no-store" } });
}
