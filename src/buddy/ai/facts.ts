import type { Strings } from "../locales";
import type { BuddyCtx, BuddyDataSource } from "../data/types";

/**
 * Fiche des faits d'un compte, donnée au modèle local pour répondre.
 *
 * Elle est construite uniquement avec la couche de données de l'assistant,
 * donc sous le même cloisonnement : un client n'y trouve que ses projets,
 * ses factures, ses commandes. Pour un administrateur, seulement les
 * compteurs de l'agence — jamais le détail d'un autre client. Les dates sont
 * suivies de leur forme ISO et les délais sont calculés ici : le modèle n'a
 * aucun calcul à faire, donc aucun chiffre à inventer.
 */

const DAY = 86_400_000;
const MAX_FACTS = 2400;

export async function accountFacts(t: Strings, ctx: BuddyCtx, source: BuddyDataSource, now: Date): Promise<string> {
  const fr = t.lang === "fr";
  const d = (iso: string | null) => (iso ? `${t.date(iso)} (${iso.slice(0, 10)})` : fr ? "non fixée" : "not set");
  const inDays = (iso: string | null) => {
    if (!iso) return "";
    const n = Math.round((new Date(iso).getTime() - now.getTime()) / DAY);
    return fr ? (n >= 0 ? `, dans ${n} jours` : `, dépassée de ${-n} jours`) : n >= 0 ? `, in ${n} days` : `, ${-n} days overdue`;
  };
  const lines: string[] = [`${fr ? "Aujourd'hui" : "Today"} : ${d(now.toISOString())}`];

  if (ctx.role === "ADMIN") {
    const s = await source.summary(ctx);
    if (s.role === "ADMIN") {
      lines.push(
        fr ? "Rôle : administrateur de l'agence Level Up IA" : "Role: Level Up IA agency administrator",
        `${fr ? "Projets en cours" : "Projects in progress"} : ${s.projectsInProgress}`,
        `${fr ? "Factures impayées" : "Unpaid invoices"} : ${s.unpaidCount} (${t.money(s.unpaidTotal)})`,
        `${fr ? "Demandes de révision" : "Revision requests"} : ${s.revisionRequests}`,
        `${fr ? "Commandes en attente de paiement" : "Orders awaiting payment"} : ${s.pendingOrders}`,
        `${fr ? "Nouvelles demandes" : "New requests"} : ${s.newRequests}`,
      );
    }
    return lines.join("\n");
  }

  const [profile, projects, invoices, orders, deliverables, messages] = await Promise.all([
    source.profile(ctx), source.projects(ctx, { limit: 10 }), source.invoices(ctx, { limit: 10 }),
    source.orders(ctx, { limit: 10 }), source.deliverables(ctx, { limit: 20 }), source.teamMessages(ctx, { limit: 1 }),
  ]);

  if (profile) lines.push(`${fr ? "Client" : "Client"} : ${profile.companyName} (${fr ? "contact" : "contact"} ${profile.contactName})`);

  lines.push(`${fr ? "Projets" : "Projects"} (${projects.length}) :`);
  for (const p of projects) {
    const files = deliverables.filter((f) => f.projectId === p.id);
    const waiting = files.filter((f) => f.approval === "EN_ATTENTE").length;
    lines.push(
      `- ${p.title}${p.serviceName ? ` [${p.serviceName}]` : ""} : ${t.projectStatus[p.status] ?? p.status}, ${p.progress} %` +
        `${p.nextStep ? `, ${fr ? "prochaine étape" : "next step"} ${p.nextStep}` : ""}` +
        `, ${fr ? "échéance" : "due"} ${d(p.dueDate)}${p.deliveredAt ? "" : inDays(p.dueDate)}` +
        `${p.deliveredAt ? `, ${fr ? "livré le" : "delivered on"} ${d(p.deliveredAt)}` : ""}` +
        `, ${files.length} ${fr ? "livrable(s)" : "deliverable(s)"}${waiting ? ` ${fr ? `dont ${waiting} à valider` : `including ${waiting} awaiting approval`}` : ""}`,
    );
  }
  if (projects.length === 0) lines.push(fr ? "- aucun projet" : "- no project");

  const unpaid = invoices.filter((i) => i.status === "EN_ATTENTE" || i.status === "EN_RETARD");
  lines.push(`${fr ? "Factures" : "Invoices"} (${invoices.length}, ${unpaid.length} ${fr ? "impayée(s)" : "unpaid"}) :`);
  for (const i of invoices) {
    lines.push(`- ${i.number}${i.projectTitle ? ` (${i.projectTitle})` : ""} : ${t.money(i.total)}, ${t.invoiceStatus[i.status] ?? i.status}, ${fr ? "échéance" : "due"} ${d(i.dueDate)}`);
  }

  lines.push(`${fr ? "Commandes" : "Orders"} (${orders.length}) :`);
  for (const o of orders) lines.push(`- ${o.packName} : ${t.money(o.amount)}, ${t.orderStatus[o.status] ?? o.status}, ${fr ? "le" : "on"} ${d(o.createdAt)}`);

  const m = messages[0];
  if (m) lines.push(`${fr ? "Dernier message de l'équipe" : "Latest team message"} (${m.projectTitle}, ${d(m.createdAt)}, ${m.senderName}) : « ${m.body.replace(/\s+/g, " ").slice(0, 220)} »`);

  const text = lines.join("\n");
  return text.length > MAX_FACTS ? `${text.slice(0, MAX_FACTS)}…` : text;
}
