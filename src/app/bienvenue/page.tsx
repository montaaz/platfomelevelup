import { redirect } from "next/navigation";
import styles from "@/styles/neu.module.css";
import { requireCtx } from "@/server/context";
import { onboardingStatus } from "@/server/services/onboarding";
import { myAccessState } from "@/server/services/orders";
import { OnboardingWizard } from "./OnboardingWizard";

export const dynamic = "force-dynamic";

/** Questionnaire d'accueil : affiché tant que le client n'a pas répondu. */
export default async function BienvenuePage() {
  const ctx = await requireCtx("CLIENT");
  // même règle qu'ailleurs : sans paiement confirmé, pas d'accès
  const access = await myAccessState(ctx);
  if (!access.accessGranted) redirect("/paiement");
  const status = await onboardingStatus(ctx);
  if (status.completed) redirect("/client");

  return (
    <main className={styles.page}>
      <OnboardingWizard
        defaultName={status.contactName || ctx.fullName}
        defaultCompany={status.companyName}
      />
    </main>
  );
}
