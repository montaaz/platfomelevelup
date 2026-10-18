import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { appointmentsFeed } from "@/server/services/appointments";

/**
 * Flux iCal des rendez-vous clients, à ajouter dans le calendrier
 * « LevelUpAI Assistant » (Google Agenda → « À partir de l'URL »).
 * Protégé par un jeton secret : BOOKING_ICS_TOKEN.
 */
export async function GET(req: NextRequest) {
  const expected = process.env.BOOKING_ICS_TOKEN ?? "";
  const given = req.nextUrl.searchParams.get("jeton") ?? "";
  const ok = expected.length >= 16 && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  return new NextResponse(await appointmentsFeed(), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=300" },
  });
}
