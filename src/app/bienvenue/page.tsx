import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { detectCountryFromRequest } from "@/lib/countries";
import { myPendingOrders } from "@/server/services/orders";
import { latestProofsByOrder } from "@/server/services/transfers";
import { BANK_ACCOUNT, transferLabel } from "@/lib/bank";
import { formatMoney } from "@/lib/format";
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
  // Commande en attente de virement : le RIB est montré en dernière étape, juste après le questionnaire.
  const pending = (await myPendingOrders(ctx))[0] ?? null;
  const pendingProof = pending ? ((await latestProofsByOrder([BigInt(pending.id)])).get(pending.id) ?? null) : null;
  const transfer = pending && pendingProof?.status !== "EN_ATTENTE"
    ? { orderId: pending.id, packName: pending.packName, amount: `${formatMoney(pending.amount, pending.currency)}${pending.isMonthly ? " / mois" : ""}`, label: transferLabel(pending.id), bank: BANK_ACCOUNT, proof: pendingProof }
    : null;

  return (
    <main className={styles.page}>
      <OnboardingWizard
        defaultName={status.contactName || ctx.fullName}
        defaultCompany={status.companyName}
        allowedNeeds={allowedNeeds}
        detectedCountry={detectedCountry}
        transfer={transfer}
      />
    </main>
  );
}
