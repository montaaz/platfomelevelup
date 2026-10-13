import { requireCtx } from "@/server/context";
import { clientNeeds } from "@/server/services/onboarding";
import { Card, CardHeader } from "@/components/ui";
import { NeedsSummary } from "@/components/NeedsSummary";
import { NeedsEditor } from "@/components/client/NeedsEditor";

export const dynamic = "force-dynamic";

/** Le paramétrage du projet : ce que le client a décrit à l'accueil, modifiable à tout moment. */
export default async function ClientNeedsPage() {
  const ctx = await requireCtx("CLIENT");
  const n = await clientNeeds(ctx);
  return (
    <div className="space-y-5 pb-8">
      <section data-tilt className="hero-gradient rounded-3xl p-6 text-white shadow-hero sm:p-7">
        <h2 className="text-[15px] font-semibold">Paramétrage de mon projet</h2>
        <p className="mt-0.5 max-w-xl text-[12.5px] text-white/80">
          Vos besoins et vos préférences (pages, couleurs, style, mood). L&apos;équipe s&apos;en sert pour démarrer votre projet ; vous pouvez les compléter à tout moment.
        </p>
      </section>
      <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader title="Modifier mes besoins" subtitle="Cochez un besoin pour décrire votre projet" />
          <NeedsEditor mainNeeds={n.mainNeeds} details={n.details} />
        </Card>
        <Card>
          <CardHeader title="Paramétrage enregistré" subtitle="Ce que l'équipe voit" />
          <NeedsSummary mainNeeds={n.mainNeeds} details={n.details} />
        </Card>
      </div>
    </div>
  );
}
