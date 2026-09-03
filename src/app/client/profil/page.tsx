import { requireCtx } from "@/server/context";
import { getMyProfile } from "@/server/services/clientActions";
import { ProfileForm } from "@/components/client/ProfileForm";
import { PasswordButton } from "@/components/layout/PasswordButton";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const ctx = await requireCtx("CLIENT");
  const profile = await getMyProfile(ctx);

  return (
    <div className="space-y-5 pb-8">
      <section data-tilt className="hero-gradient rounded-3xl p-6 text-white shadow-hero sm:p-7">
        <h2 className="text-[15px] font-semibold">Mon profil</h2>
        <p className="mt-0.5 text-[12.5px] text-white/80">
          Coordonnées, entreprise et informations de facturation — reprises sur vos prochaines factures.
        </p>
      </section>

      <ProfileForm profile={profile} />

      <section data-tilt className="glass relative max-w-2xl rounded-2xl p-6 sm:p-7">
        <h3 className="text-[14.5px] font-semibold text-ink">Sécurité</h3>
        <p className="mt-1 mb-4 text-[12.5px] text-ink/72">Changez votre mot de passe de connexion.</p>
        <PasswordButton className="btn-glass rounded-xl border border-white/80 bg-white/70 px-5 py-2.5 text-[13.5px] font-semibold text-ink/80 hover:text-brand-600" />
      </section>
    </div>
  );
}
