import { prisma } from "@/lib/prisma";
import { mirrorNotificationEmails } from "@/lib/mail";

/**
 * Background housekeeping, run at most every 10 minutes (triggered by admin
 * page loads; in production also wire it to a daily Vercel Cron for the days
 * nobody logs in). Never throws — a sweep failure must never break a page.
 */
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
const globalState = globalThis as unknown as { __lastSweep?: number };

export async function runMaintenanceSweep(): Promise<void> {
  const now = Date.now();
  if (globalState.__lastSweep && now - globalState.__lastSweep < SWEEP_INTERVAL_MS) return;
  globalState.__lastSweep = now;

  try {
    await Promise.all([markOverdueInvoices(), sendSubscriptionAlerts()]);
  } catch (e) {
    console.error("[maintenance] sweep:", e);
  }
}

/** EN_ATTENTE + past due date → EN_RETARD, and the admins are alerted. */
async function markOverdueInvoices() {
  const overdue = await prisma.invoice.findMany({
    where: { status: "EN_ATTENTE", dueDate: { lt: new Date() } },
    include: { client: true },
  });
  if (overdue.length === 0) return;

  await prisma.invoice.updateMany({
    where: { id: { in: overdue.map((i) => i.id) } },
    data: { status: "EN_RETARD" },
  });

  const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });
  for (const invoice of overdue) {
    const title = `Facture en retard — ${invoice.invoiceNumber}`;
    const body = `${invoice.client.companyName} : ${Number(invoice.total).toFixed(2)} DT, échéance dépassée.`;
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        type: "NOUVELLE_FACTURE" as const,
        title,
        body,
        entityType: "invoice",
        entityId: invoice.id,
      })),
    });
    mirrorNotificationEmails(admins.map((a) => a.id), title, body);
  }
}

/** Active subscription reaching its term within 7 days → alert BEFORE the date
 *  (acceptance criterion), once per renewal period. */
async function sendSubscriptionAlerts() {
  const soon = new Date(Date.now() + 7 * 86_400_000);
  const subs = await prisma.subscription.findMany({
    where: { status: "ACTIF", renewalDate: { lte: soon } },
    include: { client: true },
  });
  if (subs.length === 0) return;

  const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });

  for (const sub of subs) {
    const title = `Abonnement à échéance — ${sub.client.companyName}`;
    // one alert per renewal period: skip if already notified since 8 days before the date
    const periodStart = new Date(sub.renewalDate.getTime() - 8 * 86_400_000);
    const already = await prisma.notification.findFirst({
      where: { title, entityType: "subscription", entityId: sub.id, createdAt: { gte: periodStart } },
    });
    if (already) continue;

    const body = `Formule ${sub.planName} (${Number(sub.monthlyAmount).toFixed(0)} DT/mois), reconduction le ${sub.renewalDate.toLocaleDateString("fr-FR")}.`;
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        type: "ABONNEMENT_ECHEANCE" as const,
        title,
        body,
        entityType: "subscription",
        entityId: sub.id,
      })),
    });
    mirrorNotificationEmails(admins.map((a) => a.id), title, body);
  }
}
