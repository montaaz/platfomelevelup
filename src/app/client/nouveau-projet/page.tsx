import { requireCtx } from "@/server/context";
import { listServicesPublic } from "@/server/services/clientActions";
import { NewRequestForm } from "@/components/client/NewRequestForm";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  await requireCtx("CLIENT");
  const services = await listServicesPublic();

  return (
    <div className="space-y-5 pb-8">
      <section className="hero-gradient rounded-3xl p-6 text-white shadow-hero sm:p-7">
        <h2 className="text-[15px] font-semibold">Nouveau projet ou devis</h2>
        <p className="mt-0.5 max-w-xl text-[12.5px] text-white/80">
          Décrivez votre besoin : la demande arrive directement chez l&apos;équipe Level Up IA, qui revient vers vous avec
          une proposition.
        </p>
      </section>

      <NewRequestForm services={services} />
    </div>
  );
}
