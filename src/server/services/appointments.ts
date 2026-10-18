import { prisma } from "@/lib/prisma";
import { assertAdmin, clientScope, ValidationError, type Ctx } from "@/server/context";
import { appointmentsIcs, freeSlots, isBookable, parseIcsBusy, SLOT_MINUTES, type Busy } from "@/lib/booking";
import { mirrorNotificationEmails } from "@/lib/mail";
import { MAIN_NEEDS } from "@/lib/onboardingOptions";

/**
 * Rendez-vous téléphoniques (notes de Sarra, §01). Le calendrier
 * « LevelUpAI Assistant » est relié dans les deux sens :
 *   - il s'abonne au flux iCal /api/rdv/calendrier.ics?jeton=… (BOOKING_ICS_TOKEN) ;
 *   - ses occupations sont lues depuis son adresse iCal secrète (BOOKING_BUSY_ICS_URL)
 *     et retirées des créneaux proposés.
 */

let busyCache: { at: number; busy: Busy[] } | null = null;
async function calendarBusy(): Promise<Busy[]> {
  const url = process.env.BOOKING_BUSY_ICS_URL?.trim();
  if (!url) return [];
  if (busyCache && Date.now() - busyCache.at < 5 * 60_000) return busyCache.busy;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const busy = parseIcsBusy(await res.text()).filter((b) => b.end.getTime() > Date.now());
    busyCache = { at: Date.now(), busy };
    return busy;
  } catch (e) {
    console.warn("[rdv] calendrier LevelUpAI Assistant illisible:", e instanceof Error ? e.message : e);
    return busyCache?.busy ?? [];
  }
}

async function takenTimes(): Promise<Busy[]> {
  const [booked, cal] = await Promise.all([
    prisma.appointment.findMany({ where: { status: "CONFIRME", endsAt: { gt: new Date() } }, select: { startsAt: true, endsAt: true } }),
    calendarBusy(),
  ]);
  return [...booked.map((b) => ({ start: b.startsAt, end: b.endsAt })), ...cal];
}

export async function availableSlots() {
  return freeSlots(new Date(), await takenTimes());
}

export async function myNextAppointment(ctx: Ctx) {
  const clientId = clientScope(ctx);
  const a = await prisma.appointment.findFirst({ where: { clientId, status: "CONFIRME", startsAt: { gt: new Date() } }, orderBy: { startsAt: "asc" } });
  return a ? { id: a.id.toString(), start: a.startsAt.toISOString(), end: a.endsAt.toISOString(), need: a.need } : null;
}

/** Réserve un créneau libre pour le client connecté (un seul rendez-vous à venir par client). */
export async function bookAppointment(ctx: Ctx, startIso: string, rawNeed: string | null) {
  const clientId = clientScope(ctx);
  if (Number.isNaN(Date.parse(startIso))) throw new ValidationError("Créneau invalide.");
  const need = rawNeed && MAIN_NEEDS.some((o) => o.value === rawNeed) ? rawNeed : null;
  const start = new Date(startIso);
  // Le créneau précédent du client se libère : il peut changer d'horaire.
  const previous = await prisma.appointment.findFirst({ where: { clientId, status: "CONFIRME", startsAt: { gt: new Date() } } });
  const taken = (await takenTimes()).filter((b) => !(previous && b.start.getTime() === previous.startsAt.getTime()));
  if (!isBookable(start.toISOString(), new Date(), taken)) throw new ValidationError("Ce créneau vient d'être pris ou n'est plus disponible : choisissez-en un autre.");

  const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId }, select: { companyName: true, contactName: true, phone: true } });
  const needLabel = need ? MAIN_NEEDS.find((o) => o.value === need)?.label ?? need : null;
  let row;
  try {
    row = await prisma.$transaction(async (tx) => {
      if (previous) await tx.appointment.update({ where: { id: previous.id }, data: { status: "ANNULE" } });
      return tx.appointment.create({
        data: { clientId, bookedByUserId: ctx.userId, startsAt: start, endsAt: new Date(start.getTime() + SLOT_MINUTES * 60000), need, topic: needLabel },
      });
    });
  } catch {
    throw new ValidationError("Ce créneau vient d'être pris : choisissez-en un autre.");
  }
  const when = new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Tunis", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(start);
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });
  if (admins.length) {
    const title = `Échange téléphonique — ${client.companyName}`;
    const body = `${when} (heure de Tunis)${needLabel ? ` · ${needLabel}` : ""}${client.phone ? ` · ${client.phone}` : ""}`;
    await prisma.notification.createMany({ data: admins.map((a) => ({ userId: a.id, type: "DEMANDE_PROJET" as const, title, body, entityType: "appointment", entityId: row.id })) });
    mirrorNotificationEmails(admins.map((a) => a.id), title, body);
  }
  return { id: row.id.toString(), start: row.startsAt.toISOString(), end: row.endsAt.toISOString(), when };
}

export async function cancelMyAppointment(ctx: Ctx) {
  const clientId = clientScope(ctx);
  await prisma.appointment.updateMany({ where: { clientId, status: "CONFIRME", startsAt: { gt: new Date() } }, data: { status: "ANNULE" } });
}

export async function listAppointments(ctx: Ctx) {
  assertAdmin(ctx);
  const rows = await prisma.appointment.findMany({
    where: { startsAt: { gt: new Date(Date.now() - 7 * 86_400_000) } },
    orderBy: { startsAt: "asc" },
    include: { client: { select: { id: true, companyName: true, contactName: true, phone: true } } },
  });
  return rows.map((r) => ({ id: r.id.toString(), start: r.startsAt, end: r.endsAt, status: r.status, topic: r.topic, client: r.client }));
}

/** Flux iCal pour le calendrier « LevelUpAI Assistant ». */
export async function appointmentsFeed(): Promise<string> {
  const rows = await prisma.appointment.findMany({
    where: { status: "CONFIRME", startsAt: { gt: new Date(Date.now() - 30 * 86_400_000) } },
    orderBy: { startsAt: "asc" },
    include: { client: { select: { companyName: true, contactName: true, phone: true, email: true } } },
  });
  return appointmentsIcs(rows.map((r) => ({
    id: r.id.toString(), start: r.startsAt, end: r.endsAt,
    summary: `Échange — ${r.client.companyName}${r.topic ? `, ${r.topic}` : ""}`,
    description: [r.client.contactName, r.client.phone, r.client.email].filter(Boolean).join(" · "),
  })));
}
