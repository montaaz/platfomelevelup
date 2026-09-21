import { prisma } from "@/lib/prisma";
import { clientScope, ValidationError, type Ctx } from "@/server/context";
import {
  INDUSTRIES, CONTACT_ROLES, COMPANY_SIZES, MAIN_NEEDS, HEARD_FROM, isValid, type Option,
} from "@/lib/onboardingOptions";
import { COUNTRIES } from "@/lib/countries";

export type OnboardingInput = {
  contactName: string;
  phoneCountry: string;   // code pays ISO (ex. TN)
  phone: string;
  companyName: string;
  /** Secteurs cochés : un client peut relever de plusieurs métiers. */
  industries: string[];
  industryOther?: string;
  contactRole: string;
  contactRoleOther?: string;
  companySize: string;
  mainMarket: string;     // code pays ISO
  /** Besoins cochés : un client en veut souvent plusieurs. */
  mainNeeds: string[];
  /** Origines cochées (facultatif). */
  heardFroms?: string[];
  heardFromOther?: string;
};

/** Le client a-t-il déjà répondu au questionnaire ? */
export async function onboardingStatus(ctx: Ctx) {
  const clientId = clientScope(ctx);
  const client = await prisma.client.findUniqueOrThrow({
    where: { id: clientId },
    select: { companyName: true, contactName: true, phone: true, onboardingCompletedAt: true },
  });
  return {
    completed: client.onboardingCompletedAt != null,
    companyName: client.companyName,
    contactName: client.contactName,
    phone: client.phone,
  };
}

/**
 * Nettoie et valide une liste de réponses cochées.
 *
 * Écarte les doublons, refuse toute valeur hors de la liste proposée, et
 * réordonne selon le questionnaire plutôt que selon l'ordre des clics : deux
 * clients ayant coché les mêmes cases obtiennent ainsi la même fiche.
 */
function cleanChoices(
  values: string[] | undefined,
  options: Option[],
  label: string,
  required: boolean,
): string[] {
  const list = [...new Set(values ?? [])];
  if (list.length === 0) {
    if (required) throw new ValidationError(`Merci de choisir au moins un ${label.toLowerCase()}.`);
    return [];
  }
  if (list.length > options.length) throw new ValidationError(`Trop de réponses pour : ${label}.`);
  if (!list.every((v) => isValid(options, v))) throw new ValidationError(`${label} invalide.`);
  return list.sort(
    (a, b) => options.findIndex((o) => o.value === a) - options.findIndex((o) => o.value === b),
  );
}

const need = (v: string | undefined, label: string, max = 160) => {
  const s = v?.trim() ?? "";
  if (!s) throw new ValidationError(`${label} est obligatoire.`);
  if (s.length > max) throw new ValidationError(`${label} est trop long.`);
  return s;
};

/** Enregistre les réponses. Toutes les valeurs sont validées côté serveur. */
export async function saveOnboarding(ctx: Ctx, input: OnboardingInput) {
  const clientId = clientScope(ctx);

  const contactName = need(input.contactName, "Le nom et prénom");
  const companyName = need(input.companyName, "Le nom de l'entreprise");

  const phoneCountry = input.phoneCountry?.trim() ?? "";
  if (!COUNTRIES.some((c) => c.code === phoneCountry)) {
    throw new ValidationError("Indicatif téléphonique invalide.");
  }
  const phoneDigits = (input.phone ?? "").replace(/[^\d]/g, "");
  if (phoneDigits.length < 6 || phoneDigits.length > 15) {
    throw new ValidationError("Numéro de téléphone invalide.");
  }

  const industries = cleanChoices(input.industries, INDUSTRIES, "Secteur d'activité", true);
  const mainNeeds = cleanChoices(input.mainNeeds, MAIN_NEEDS, "Besoin", true);
  const heardFroms = cleanChoices(input.heardFroms, HEARD_FROM, "Origine", false);
  if (!isValid(CONTACT_ROLES, input.contactRole)) throw new ValidationError("Fonction invalide.");
  if (!isValid(COMPANY_SIZES, input.companySize)) throw new ValidationError("Taille d'entreprise invalide.");
  if (!COUNTRIES.some((c) => c.code === input.mainMarket)) {
    throw new ValidationError("Pays / marché principal invalide.");
  }

  // les champs « Autre » ne sont exigés que si l'option Autre est choisie
  const industryOther = industries.includes("AUTRE") ? need(input.industryOther, "Précisez le secteur") : null;
  const contactRoleOther = input.contactRole === "AUTRE" ? need(input.contactRoleOther, "Précisez la fonction") : null;
  const heardFromOther = heardFroms.includes("AUTRE") ? need(input.heardFromOther, "Précisez l'origine") : null;

  const dial = COUNTRIES.find((c) => c.code === phoneCountry)!.dial;

  await prisma.client.update({
    where: { id: clientId },
    data: {
      contactName,
      companyName,
      phoneCountryCode: phoneCountry,
      phone: `${dial} ${phoneDigits}`,
      // `industry` garde le secteur principal : tout ce qui l'affiche déjà
      // continue de fonctionner sans changement.
      industry: industries[0]!,
      industries,
      industryOther,
      contactRole: input.contactRole,
      contactRoleOther,
      companySize: input.companySize,
      mainMarket: input.mainMarket,
      // Valeur principale conservée : tout ce qui la lit déjà continue de marcher.
      mainNeed: mainNeeds[0]!,
      mainNeeds,
      heardFrom: heardFroms[0] ?? null,
      heardFroms,
      heardFromOther,
      onboardingCompletedAt: new Date(),
    },
  });

  // l'équipe est prévenue : un nouveau profil client est exploitable
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });
  if (admins.length > 0) {
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        type: "DEMANDE_PROJET" as const,
        title: `Profil complété — ${companyName}`,
        body: `${contactName} a renseigné son questionnaire d'accueil.`,
        entityType: "client",
        entityId: clientId,
      })),
    });
  }

  await prisma.auditLog.create({
    data: { userId: ctx.userId, action: "ONBOARDING_COMPLETE", entityType: "client", entityId: clientId },
  });

  return true;
}
