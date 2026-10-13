import { MAIN_NEEDS, labelOf } from "@/lib/onboardingOptions";
import { needsSummary } from "@/lib/needs";

/**
 * Le paramétrage du projet tel que le client l'a décrit — lu par le client
 * (son espace) et par l'équipe (fiche client, fiche projet). Même composant,
 * même lecture : personne ne découvre une information que l'autre n'a pas.
 */
export function NeedsSummary({ mainNeeds, details, compact = false }: { mainNeeds: string[]; details: unknown; compact?: boolean }) {
  const blocks = needsSummary(mainNeeds, details, (code) => labelOf(MAIN_NEEDS, code) ?? code);
  if (blocks.length === 0) return <p className="px-6 pb-5 text-[13px] text-ink/60">Aucun besoin renseigné pour le moment.</p>;
  return (
    <div className={`divide-y divide-ink/4 ${compact ? "" : "pb-2"}`}>
      {blocks.map((b) => (
        <div key={b.need} className="px-5 py-4 sm:px-6">
          <p className="text-[13.5px] font-semibold text-ink">✔ {b.title}</p>
          {b.rows.length === 0 ? (
            <p className="mt-1 text-[12.5px] text-ink/55">Aucun détail précisé.</p>
          ) : (
            <dl className="mt-2 space-y-2.5">
              {b.rows.map((r, i) => (
                <div key={i}>
                  <dt className="text-[11px] font-semibold tracking-wide text-ink/55 uppercase">{r.label}</dt>
                  <dd className="mt-1">
                    {r.text && <p className={`text-[13px] whitespace-pre-line ${r.flag ? "font-semibold text-brand-600" : "text-ink/85"}`}>{r.text}</p>}
                    {r.chips && (
                      <div className="flex flex-wrap gap-1.5">
                        {r.chips.map((c) => (
                          <span key={c} className="rounded-full bg-white/70 px-2.5 py-1 text-[12px] font-medium text-ink/80 ring-1 ring-ink/8">{c}</span>
                        ))}
                      </div>
                    )}
                    {r.palette && (
                      <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-2.5 py-1 text-[12px] font-medium text-ink/80 ring-1 ring-ink/8">
                        <span className="inline-flex gap-1">
                          {r.palette.colors.map((c) => <span key={c} className="inline-block h-3.5 w-3.5 rounded-full ring-1 ring-black/10" style={{ background: c }} />)}
                        </span>
                        {r.palette.label}
                      </span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      ))}
    </div>
  );
}
