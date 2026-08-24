import { requireCtx } from "@/server/context";
import { listTeam } from "@/server/services/directory";
import { Card, CardHeader, Avatar, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminTeamPage() {
  const ctx = await requireCtx("ADMIN");
  const team = await listTeam(ctx);
  const totalActive = team.reduce((s, m) => s + m.activeProjects, 0);

  return (
    <div className="space-y-5 pb-8">
      <section className="hero-gradient rounded-3xl p-6 text-white shadow-hero sm:p-7">
        <h2 className="text-[15px] font-semibold">Équipe</h2>
        <p className="mt-0.5 text-[12px] text-white/50">
          Membres à qui un projet est attribué — la charge de chacun se lit ici.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-6 lg:divide-x lg:divide-white/10">
          <div className="lg:pr-6">
            <p className="text-[12px] text-white/55">Membres actifs</p>
            <p className="mt-1 text-[28px] leading-none font-bold">{team.length}</p>
          </div>
          <div className="lg:pl-6">
            <p className="text-[12px] text-white/55">Projets portés</p>
            <p className="mt-1 text-[28px] leading-none font-bold">{totalActive}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {team.length === 0 && (
          <Card className="md:col-span-2 xl:col-span-3">
            <EmptyState message="Aucun membre d'équipe." />
          </Card>
        )}
        {team.map((member) => (
          <Card key={member.id}>
            <div className="p-5 sm:p-6">
              <div className="flex items-center gap-3.5">
                <Avatar name={member.fullName} size={46} />
                <div className="min-w-0">
                  <p className="truncate text-[14.5px] font-semibold text-ink">{member.fullName}</p>
                  <p className="truncate text-[12.5px] text-slate-400">{member.jobTitle ?? "Membre de l'équipe"}</p>
                </div>
                <span className="ml-auto rounded-full bg-brand-50 px-3 py-1.5 text-[12.5px] font-semibold text-brand-600">
                  {member.activeProjects}
                </span>
              </div>
              <div className="mt-4 space-y-1.5">
                <p className="text-[10.5px] font-semibold tracking-[0.1em] text-slate-400 uppercase">Charge actuelle</p>
                {member.currentWork.length === 0 && <p className="text-[12.5px] text-slate-400">Disponible</p>}
                {member.currentWork.map((w) => (
                  <p key={w} className="truncate text-[12.5px] text-slate-600">
                    • {w}
                  </p>
                ))}
              </div>
              {(member.email || member.phone) && (
                <p className="mt-4 truncate border-t border-ink/5 pt-3 text-[12px] text-slate-400">
                  {member.email ?? member.phone}
                </p>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
