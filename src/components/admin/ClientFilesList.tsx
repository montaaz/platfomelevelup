import { listClientFiles } from "@/server/services/clientFiles";
import { MAIN_NEEDS } from "@/lib/onboardingOptions";
import type { Ctx } from "@/server/context";
import { EmptyState } from "@/components/ui";

const fmt = (n: number) => (n >= 1_048_576 ? `${(n / 1_048_576).toFixed(1)} Mo` : `${Math.max(1, Math.round(n / 1024))} Ko`);

/** Fichiers déposés par un client, pour les fiches client et projet (admin). */
export async function ClientFilesList({ ctx, clientId }: { ctx: Ctx; clientId: bigint }) {
  const files = await listClientFiles(ctx, { clientId });
  if (files.length === 0) return <EmptyState message="Aucun fichier déposé par le client." />;
  const label = (code: string | null) => MAIN_NEEDS.find((o) => o.value === code)?.label ?? "Général";
  return (
    <ul className="divide-y divide-ink/4">
      {files.map((f) => (
        <li key={f.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-6 py-3 text-[13px]">
          <a href={`/api/fichiers/${f.id}`} className="font-semibold text-brand-600 hover:underline">{f.name}</a>
          <span className="text-ink/55">{label(f.need)}</span>
          <span className="text-ink/55">{fmt(f.size)}</span>
          <span className="ml-auto text-[12px] text-ink/45">{new Date(f.createdAt).toLocaleDateString("fr-FR")}</span>
        </li>
      ))}
    </ul>
  );
}
