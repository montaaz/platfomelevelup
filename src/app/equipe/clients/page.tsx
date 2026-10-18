import Link from "next/link";
import { requireCtx } from "@/server/context";
import { teamClients } from "@/server/services/teamPortal";
import { PROJECT_STATUS_LABEL } from "@/lib/format";
import { Card, CardHeader, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

/** Annuaire des clients et de leurs projets (coordonnées uniquement, aucune donnée financière). */
export default async function TeamClientsPage() {
  const ctx = await requireCtx("EQUIPE");
  const clients = await teamClients(ctx);
  return (
    <div className="space-y-5 pb-8">
      <Card>
        <CardHeader title="Clients" subtitle={`${clients.length} client(s)`} />
        {clients.length === 0 ? <EmptyState message="Aucun client." /> : (
          <ul className="divide-y divide-ink/4">
            {clients.map((c) => (
              <li key={c.id} className="px-6 py-3 text-[13px]">
                <p className="font-semibold text-ink">{c.name}</p>
                <p className="text-ink/60">{[c.contact, c.email, c.phone, c.country].filter(Boolean).join(" · ")}</p>
                {c.projects.length > 0 && (
                  <ul className="mt-1 flex flex-wrap gap-2">
                    {c.projects.map((p) => (
                      <li key={p.id}>
                        <Link href={`/equipe/projets/${p.id}`} className="rounded-full bg-ink/5 px-2.5 py-0.5 text-[12px] text-brand-600 hover:underline">
                          {p.title} · {PROJECT_STATUS_LABEL[p.status] ?? p.status}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
