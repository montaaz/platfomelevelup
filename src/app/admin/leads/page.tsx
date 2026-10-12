import { requireCtx } from "@/server/context";
import { listLeads, INTENT_LABEL, type LeadRow } from "@/server/services/socialBrain";
import { Card, CardHeader, Avatar, EmptyState } from "@/components/ui";
import { LeadStatus } from "@/components/admin/LeadStatus";
import { formatDateFull, relativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const CHANNEL_LABEL: Record<string, string> = {
  instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn", tiktok: "TikTok", email: "E-mail", site: "Site", whatsapp: "WhatsApp",
};
const STATUS_LABEL: Record<string, string> = { NOUVEAU: "Nouveau", EN_COURS: "En cours", CONVERTI: "Converti", PERDU: "Perdu" };

function heat(score: number) {
  if (score >= 70) return { label: `🔥 chaud · ${score}`, cls: "bg-red-50 text-red-600" };
  if (score >= 40) return { label: `🌤 tiède · ${score}`, cls: "bg-amber-50 text-amber-700" };
  return { label: `❄️ froid · ${score}`, cls: "bg-slate-100 text-ink/60" };
}

type Contact = { key: string; latest: LeadRow; messages: LeadRow[]; score: number; handoff: boolean };

/** Un contact = un identifiant sur un canal ; ses messages sont regroupés, le plus récent en tête. */
function groupContacts(leads: LeadRow[]): Contact[] {
  const map = new Map<string, Contact>();
  for (const l of leads) {
    const key = `${l.channel}:${l.externalId ?? l.contact ?? l.displayName ?? l.id}`;
    const c = map.get(key);
    if (c) {
      c.messages.push(l);
      c.score = Math.max(c.score, l.score);
      c.handoff = c.handoff || (l.handoff && l.status === "NOUVEAU");
    } else map.set(key, { key, latest: l, messages: [l], score: l.score, handoff: l.handoff && l.status === "NOUVEAU" });
  }
  // Passations en attente d'abord, puis les plus chauds, puis les plus récents.
  return [...map.values()].sort((a, b) => Number(b.handoff) - Number(a.handoff) || b.score - a.score || b.latest.createdAt.localeCompare(a.latest.createdAt));
}

export default async function AdminLeadsPage() {
  await requireCtx("ADMIN");
  const leads = await listLeads();
  const contacts = groupContacts(leads);
  const dayAgo = Date.now() - 86_400_000;
  const today = leads.filter((l) => new Date(l.createdAt).getTime() > dayAgo).length;
  const hot = contacts.filter((c) => c.score >= 70 && c.latest.status !== "PERDU" && c.latest.status !== "CONVERTI").length;
  const handoffs = contacts.filter((c) => c.handoff).length;
  const converted = contacts.filter((c) => c.latest.status === "CONVERTI").length;

  return (
    <div className="space-y-5 pb-8">
      <section data-tilt className="hero-gradient rounded-3xl p-6 text-white shadow-hero sm:p-7">
        <h2 className="text-[15px] font-semibold">Leads entrants</h2>
        <p className="mt-0.5 text-[12.5px] text-white/80">
          Réseaux sociaux, WhatsApp et e-mail, répondus par l&apos;assistant. Les contacts qui attendent un humain sont en tête.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-6">
          <div className="glass-dark kpi-tile rounded-2xl p-3 sm:p-4">
            <p className="text-[12px] text-white/80">À reprendre par l&apos;équipe</p>
            <p className="mt-1 text-[22px] leading-none font-bold sm:text-[28px]">{handoffs}</p>
          </div>
          <div className="glass-dark kpi-tile rounded-2xl p-3 sm:p-4">
            <p className="text-[12px] text-white/80">Prospects chauds</p>
            <p className="mt-1 text-[22px] leading-none font-bold sm:text-[28px]">{hot}</p>
          </div>
          <div className="glass-dark kpi-tile rounded-2xl p-3 sm:p-4">
            <p className="text-[12px] text-white/80">Messages · 24 h</p>
            <p className="mt-1 text-[22px] leading-none font-bold sm:text-[28px]">{today}</p>
          </div>
          <div className="glass-dark kpi-tile rounded-2xl p-3 sm:p-4">
            <p className="text-[12px] text-white/80">Convertis</p>
            <p className="mt-1 text-[22px] leading-none font-bold sm:text-[28px]">{converted}</p>
          </div>
        </div>
      </section>

      <Card>
        <CardHeader title="Derniers messages" subtitle={`${contacts.length} contact${contacts.length > 1 ? "s" : ""} · ${leads.length} message${leads.length > 1 ? "s" : ""} — un contact par bloc, ses échanges dépliables`} />
        <div className="divide-y divide-ink/4 pb-2">
          {contacts.length === 0 && <EmptyState message="Aucun message reçu pour le moment." />}
          {contacts.map((c) => {
            const l = c.latest;
            const h = heat(c.score);
            return (
              <div key={c.key} className={`px-4 py-4 sm:px-6 ${c.handoff ? "bg-rose-50/40" : ""}`}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <Avatar name={l.displayName ?? l.contact ?? l.channel} size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold text-ink">
                      {l.displayName ?? l.contact ?? l.externalId ?? "Contact inconnu"}
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-600">{CHANNEL_LABEL[l.channel] ?? l.channel}</span>
                      {l.intent && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">{INTENT_LABEL[l.intent] ?? l.intent}</span>}
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${h.cls}`}>{h.label}</span>
                      {c.handoff && <span className="rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-semibold text-white">🙋 à reprendre</span>}
                      {l.packCode && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">{l.packCode}</span>}
                    </p>
                    <p className="truncate text-[12px] text-ink/60">
                      {l.summary ?? l.message.slice(0, 100)} · {relativeTime(l.createdAt)}
                      {c.messages.length > 1 ? ` · ${c.messages.length} messages` : ""}
                      {l.contact && l.displayName ? ` · ${l.contact}` : ""}
                    </p>
                  </div>
                  <LeadStatus leadId={l.id} status={l.status} />
                </div>
                <details className="mt-3 group">
                  <summary className="cursor-pointer text-[12.5px] font-medium text-brand-600 hover:text-brand-700">
                    Voir la conversation
                  </summary>
                  <div className="mt-2 space-y-3">
                    {[...c.messages].reverse().map((m) => (
                      <div key={m.id}>
                        <p className="text-[11px] text-ink/50">{formatDateFull(m.createdAt)}{m.answeredByAi ? " · réponse rédigée par l'IA" : " · réponse type"}{m.handoff ? " · passation demandée" : ""}</p>
                        <p className="mt-0.5 rounded-2xl bg-white/70 px-4 py-2.5 text-[13px] whitespace-pre-line text-ink/85">{m.message}</p>
                        {m.reply && <p className="mt-1 ml-6 rounded-2xl bg-slate-100/80 px-4 py-2.5 text-[12.5px] whitespace-pre-line text-ink/75">{m.reply}</p>}
                      </div>
                    ))}
                  </div>
                </details>
                {STATUS_LABEL[l.status] === undefined && null}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
