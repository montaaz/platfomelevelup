import { describe, expect, it } from "vitest";
import { appointmentsIcs, freeSlots, isBookable, parseIcsBusy } from "@/lib/booking";

// Lundi 19 octobre 2026, 10:00 à Tunis (UTC+1).
const now = new Date("2026-10-19T09:00:00Z");

describe("créneaux d'échange téléphonique", () => {
  it("propose des créneaux de 30 min dans les plages d'ouverture, jamais le dimanche", () => {
    const slots = freeSlots(now, []);
    expect(slots.length).toBeGreaterThan(50);
    // mardi 20 octobre : premier créneau 09:00 heure de Tunis = 08:00Z
    expect(slots[0]!.start).toBe("2026-10-20T08:00:00.000Z");
    const sundays = slots.filter((s) => new Date(s.start).getUTCDay() === 0);
    expect(sundays).toHaveLength(0);
    // pause de midi : aucun créneau à 13:00 (12:00Z)
    expect(slots.some((s) => s.start === "2026-10-20T12:00:00.000Z")).toBe(false);
  });

  it("retire les créneaux déjà réservés et ceux occupés dans le calendrier", () => {
    const taken = [{ start: new Date("2026-10-20T08:00:00Z"), end: new Date("2026-10-20T08:30:00Z") }];
    expect(isBookable("2026-10-20T08:00:00.000Z", now, taken)).toBe(false);
    expect(isBookable("2026-10-20T08:30:00.000Z", now, taken)).toBe(true);
    expect(isBookable("2026-10-20T03:00:00.000Z", now, [])).toBe(false); // hors ouverture
  });

  it("lit les occupations d'un flux iCal et produit un flux iCal valide", () => {
    const busy = parseIcsBusy("BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART:20261020T090000Z\r\nDTEND:20261020T100000Z\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nTRANSP:TRANSPARENT\r\nDTSTART:20261020T130000Z\r\nDTEND:20261020T140000Z\r\nEND:VEVENT\r\nEND:VCALENDAR");
    expect(busy).toHaveLength(1);
    expect(isBookable("2026-10-20T09:00:00.000Z", now, busy)).toBe(false);
    const ics = appointmentsIcs([{ id: "1", start: new Date("2026-10-20T08:00:00Z"), end: new Date("2026-10-20T08:30:00Z"), summary: "Échange — Boutique, site marchand", description: "Tél. 216" }]);
    expect(ics).toContain("DTSTART:20261020T080000Z");
    expect(ics).toContain("SUMMARY:Échange — Boutique\\, site marchand");
  });
});
