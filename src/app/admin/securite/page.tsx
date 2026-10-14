import { requireCtx } from "@/server/context";
import { antivirusStatus, listSecurityEvents } from "@/server/services/clientFiles";
import { Card, CardHeader, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

const SEV: Record<string, string> = { info: "bg-ink/5 text-ink/70", suspect: "bg-amber-100 text-amber-800", critique: "bg-red-100 text-red-700" };
const KIND: Record<string, string> = {
  UPLOAD_REFUSE: "Fichier refusé (format)", UPLOAD_SUSPECT: "Fichier suspect refusé", UPLOAD_BLOQUE: "Dépôt suspendu",
  ANTIVIRUS_INFECTE: "Fichier infecté détruit", ANTIVIRUS_INDISPONIBLE: "Antivirus indisponible",
};

/** Journal de sécurité : fichiers refusés ou suspects, antivirus, blocages. */
export default async function AdminSecurityPage() {
  const ctx = await requireCtx("ADMIN");
  const [events, av] = await Promise.all([listSecurityEvents(ctx), antivirusStatus()]);
  const suspects = events.filter((e) => e.severity !== "info").length;
  return (
    <div className="space-y-5 pb-8">
      <section data-tilt className="hero-gradient rounded-3xl p-6 text-white shadow-hero sm:p-7">
        <h2 className="text-[15px] font-semibold">Sécurité des fichiers</h2>
        <p className="mt-0.5 max-w-2xl text-[12.5px] text-white/80">
          Chaque fichier déposé par un client est vérifié (extension, signature, contenu) puis analysé par l&apos;antivirus avant d&apos;être conservé hors du site web. Les refus suspects vous sont signalés ici et par notification.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-6">
          <div className="glass-dark kpi-tile rounded-2xl p-3 sm:p-4"><p className="text-[12px] text-white/80">Événements récents</p><p className="mt-1 text-[22px] leading-none font-bold sm:text-[28px]">{events.length}</p></div>
          <div className="glass-dark kpi-tile rounded-2xl p-3 sm:p-4"><p className="text-[12px] text-white/80">Suspects / critiques</p><p className="mt-1 text-[22px] leading-none font-bold sm:text-[28px]">{suspects}</p></div>
          <div className="glass-dark kpi-tile rounded-2xl p-3 sm:p-4 col-span-2 sm:col-span-1"><p className="text-[12px] text-white/80">Antivirus</p><p className="mt-1 text-[13px] font-semibold">{av.installed ? "✅ " : "⚠️ "}{av.detail}</p></div>
        </div>
      </section>
      <Card>
        <CardHeader title="Journal" subtitle="150 derniers événements — le fichier refusé n'est jamais conservé" />
        {events.length === 0 ? <EmptyState message="Aucun événement de sécurité." /> : (
          <div className="overflow-x-auto">
            <table className="rt w-full min-w-175 text-left">
              <thead><tr className="border-y border-ink/5 text-[10.5px] font-semibold tracking-[0.1em] text-ink/60 uppercase"><th className="px-6 py-2.5">Date</th><th className="px-4 py-2.5">Gravité</th><th className="px-4 py-2.5">Type</th><th className="px-4 py-2.5">Client</th><th className="px-4 py-2.5">Fichier et raison</th><th className="px-4 py-2.5">IP</th></tr></thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-b border-ink/4 align-top last:border-0">
                    <td className="px-6 py-3 text-[12.5px] whitespace-nowrap text-ink/70">{e.createdAt.toLocaleString("fr-FR")}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${SEV[e.severity] ?? SEV.info}`}>{e.severity}</span></td>
                    <td className="px-4 py-3 text-[12.5px]">{KIND[e.kind] ?? e.kind}</td>
                    <td className="px-4 py-3 text-[12.5px]">{e.clientId ? <a className="text-brand-600 hover:underline" href={`/admin/clients/${e.clientId}`}>{e.client ?? e.clientId}</a> : "—"}<br /><span className="text-ink/50">{e.user}</span></td>
                    <td className="px-4 py-3 text-[12.5px]">{e.fileName && <strong className="block">{e.fileName}</strong>}{e.reason}{e.sha256 && <span className="block text-[11px] text-ink/40">sha256 {e.sha256.slice(0, 16)}…</span>}</td>
                    <td className="px-4 py-3 text-[12px] text-ink/60">{e.ip ?? "—"}<br /><span className="text-ink/40">{e.userAgent?.slice(0, 40)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
