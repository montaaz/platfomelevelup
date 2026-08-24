import { requireCtx } from "@/server/context";
import { getMyProfile } from "@/server/services/clientActions";
import { ProfileForm } from "@/components/client/ProfileForm";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const ctx = await requireCtx("CLIENT");
  const profile = await getMyProfile(ctx);

  return (
    <div className="space-y-5 pb-8">
      <section className="hero-gradient rounded-3xl p-6 text-white shadow-hero sm:p-7">
        <h2 className="text-[15px] font-semibold">Mon profil</h2>
        <p className="mt-0.5 text-[12.5px] text-white/55">
          Coordonnées, entreprise et informations de facturation — reprises sur vos prochaines factures.
        </p>
      </section>

      <ProfileForm profile={profile} />
    </div>
  );
}
