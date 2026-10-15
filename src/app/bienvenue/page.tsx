import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { detectCountryFromRequest } from "@/lib/countries";
import styles from "@/styles/neu.module.css";
import { ctxOrNull } from "@/server/context";
import { clientAllowedNeeds, onboardingStatus } from "@/server/services/onboarding";
import { OnboardingWizard } from "./OnboardingWizard";

export const dynamic = "force-dynamic";

/** Questionnaire d'accueil : affiché tant que le client n'a pas répondu. */
export default async function BienvenuePage() {
  const ctx = await ctxOrNull("CLIENT");
  if (!ctx) redirect("/api/auth/logout?motif=compte_bloque");
  const status = await onboardingStatus(ctx);
  if (status.completed) redirect("/client");
  // Étape « Vos besoins » : seulement les besoins du pack commandé.
  const allowedNeeds = await clientAllowedNeeds(ctx);
  // Pays de connexion (Cloudflare), sinon celui mémorisé au profil : préremplit l'indicatif et le marché principal.
  const hit = detectCountryFromRequest(await headers());
  const stored = ctx.clientId ? await prisma.client.findUnique({ where: { id: ctx.clientId }, select: { detectedCountryCode: true } }) : null;
  const detectedCountry = hit?.code ?? stored?.detectedCountryCode ?? null;

  return (
    <main className={styles.page}>
      <OnboardingWizard
        defaultName={status.contactName || ctx.fullName}
        defaultCompany={status.companyName}
        allowedNeeds={allowedNeeds}
        detectedCountry={detectedCountry}
      />
    </main>
  );
}
