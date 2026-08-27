import { requireCtx } from "@/server/context";
import { listClients } from "@/server/services/directory";
import { Card, CardHeader, Avatar, EmptyState } from "@/components/ui";
import { ClientFormButton } from "@/components/admin/ClientFormModal";
import { formatDT } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminClientsPage() {
  const ctx = await requireCtx("ADMIN");
  const clients = await listClients(ctx);
  const totalUnpaid = clients.reduce((s, c) => s + c.unpaidTotal, 0);

  return (
    <div className="space-y-5 pb-8">
      <section data-tilt className="hero-gradient rounded-3xl p-6 text-white shadow-hero sm:p-7">
        <h2 className="text-[15px] font-semibold">Clients de l&apos;agence</h2>
        <div className="mt-5 kpi-scroll flex gap-3 overflow-x-auto sm:grid sm:grid-cols-3 sm:gap-6 sm:overflow-visible">
          <div className="glass-dark kpi-tile rounded-2xl p-4">
            <p className="text-[12px] text-white/80">Clients actifs</p>
            <p className="mt-1 text-[22px] leading-none font-bold sm:text-[28px]">{clients.filter((c) => c.isActive).length}</p>
          </div>
          <div className="glass-dark kpi-tile rounded-2xl p-4">
            <p className="text-[12px] text-white/80">Projets en cours</p>
            <p className="mt-1 text-[22px] leading-none font-bold sm:text-[28px]">{clients.reduce((s, c) => s + c.activeProjects, 0)}</p>
          </div>
          <div className="glass-dark kpi-tile rounded-2xl p-4">
            <p className="text-[12px] text-white/80">Impayés cumulés</p>
            <p className="mt-1 text-[22px] leading-none font-bold sm:text-[28px]">{formatDT(totalUnpaid)}</p>
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <ClientFormButton />
      </div>

      <Card>
        <CardHeader title="Tous les clients" subtitle={`${clients.length} fiche${clients.length > 1 ? "s" : ""}`} />
        <div className="overflow-x-auto">
          <table className="rt w-full min-w-175 text-left">
            <thead>
              <tr className="border-y border-ink/5 text-[10.5px] font-semibold tracking-[0.1em] text-ink/60 uppercase">
                <th className="px-6 py-2.5">Entreprise</th>
                <th className="px-4 py-2.5">Contact</th>
                <th className="px-4 py-2.5">Projets</th>
                <th className="px-4 py-2.5">Abonnement</th>
                <th className="px-4 py-2.5 text-right">Payé</th>
                <th className="px-4 py-2.5 text-right">Impayé</th>
                <th className="px-6 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} className="border-b border-ink/4 last:border-0 hover:bg-white/40">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={client.companyName} size={38} />
                      <div className="min-w-0">
                        <p className="sm:truncate text-[13.5px] font-semibold text-ink">{client.companyName}</p>
                        <p className="truncate text-[12px] text-ink/60">{client.city ?? client.email ?? "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-[13px] text-ink">{client.contactName}</p>
                    <p className="text-[11.5px] text-ink/60">{client.phone ?? client.email ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3.5 text-[13px] text-ink/82">
                    <span className="font-semibold text-ink">{client.activeProjects}</span> en cours ·{" "}
                    {client.totalProjects} au total
                  </td>
                  <td className="px-4 py-3.5">
                    {client.subscription ? (
                      <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[12px] font-medium text-violet-600">
                        {client.subscription}
                      </span>
                    ) : (
                      <span className="text-[12.5px] text-ink/60">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right text-[13px] font-medium text-emerald-600">
                    {formatDT(client.paidTotal)}
                  </td>
                  <td className={`px-4 py-3.5 text-right text-[13px] font-semibold ${client.unpaidTotal > 0 ? "text-red-500" : "text-ink/60"}`}>
                    {client.unpaidTotal > 0 ? formatDT(client.unpaidTotal) : "—"}
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <ClientFormButton
                      editId={client.id}
                      initial={{
                        companyName: client.companyName,
                        contactName: client.contactName,
                        email: client.email ?? "",
                        phone: client.phone ?? "",
                        address: client.address ?? "",
                        city: client.city ?? "",
                        taxId: client.taxId ?? "",
                        billingAddress: client.billingAddress ?? "",
                        notes: client.notes ?? "",
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {clients.length === 0 && <EmptyState message="Aucun client." />}
        </div>
      </Card>
    </div>
  );
}
