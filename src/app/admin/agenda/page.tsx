import { requireCtx } from "@/server/context";
import { listAppointments } from "@/server/services/appointments";
import { Card, CardHeader, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

const fmt = (d: Date) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Tunis", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(d);

/** Échanges téléphoniques réservés par les clients, et lien du calendrier LevelUpAI Assistant. */
export default async function AdminAgendaPage() {
  const ctx = await requireCtx("ADMIN");
  const rows = await listAppointments(ctx);
  const token = process.env.BOOKING_ICS_TOKEN ?? "";
  const base = (process.env.APP_URL ?? "https://levelupia.app").replace(/\/+$/, "").replace(/:\d+$/, "");
  const feed = token.length >= 16 ? `${base}/api/rdv/calendrier.ics?jeton=${token}` : null;
  const upcoming = rows.filter((r) => r.status === "CONFIRME" && r.end > new Date());
  return (
    <div className="space-y-5 pb-8">
      <section data-tilt className="hero-gradient rounded-3xl p-6 text-white shadow-hero sm:p-7">
        <h2 className="text-[15px] font-semibold">Agenda des échanges</h2>
        <p className="mt-0.5 max-w-2xl text-[12.5px] text-white/80">
          Les clients réservent un échange de 30 minutes sur les seuls créneaux libres (lundi–vendredi 9 h–12 h 30 et 14 h–17 h 30, samedi 10 h–13 h, heure de Tunis), moins les occupations du calendrier LevelUpAI Assistant.
        </p>
        <p className="mt-4 text-[22px] font-bold">{upcoming.length} <span className="text-[13px] font-medium text-white/80">échange(s) à venir</span></p>
      </section>
      <Card>
        <CardHeader title="Calendrier LevelUpAI Assistant" subtitle="Abonnez le calendrier à ce flux pour y voir chaque réservation" />
        <div className="space-y-2 px-6 pb-5 text-[13px] text-ink/80">
          {feed ? (
            <>
              <p>Google Agenda → Autres agendas → <b>À partir de l&apos;URL</b>, puis collez :</p>
              <code className="block break-all rounded-xl bg-ink/5 px-3 py-2 text-[12px]">{feed}</code>
            </>
          ) : (
            <p className="text-amber-700">Flux non configuré : renseignez BOOKING_ICS_TOKEN (16 caractères minimum) dans le .env du serveur.</p>
          )}
          <p className="text-ink/60">
            Occupations reprises du calendrier : {process.env.BOOKING_BUSY_ICS_URL ? "oui (adresse iCal secrète configurée)" : "non configurées — renseignez BOOKING_BUSY_ICS_URL avec l'adresse iCal secrète du calendrier pour masquer ses heures occupées"}.
          </p>
        </div>
      </Card>
      <Card>
        <CardHeader title="Rendez-vous" subtitle="7 derniers jours et à venir" />
        {rows.length === 0 ? <EmptyState message="Aucun échange réservé." /> : (
          <ul className="divide-y divide-ink/4">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-6 py-3 text-[13px]">
                <span className="font-semibold capitalize text-ink">{fmt(r.start)}</span>
                <a href={`/admin/clients/${r.client.id}`} className="text-brand-600 hover:underline">{r.client.companyName}</a>
                <span className="text-ink/60">{r.client.contactName}{r.client.phone ? ` · ${r.client.phone}` : ""}</span>
                {r.topic && <span className="text-ink/60">{r.topic}</span>}
                <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.status === "CONFIRME" ? "bg-emerald-50 text-emerald-700" : "bg-ink/5 text-ink/50"}`}>{r.status === "CONFIRME" ? "confirmé" : "annulé"}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
