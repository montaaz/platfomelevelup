import { prisma } from "@/lib/prisma";
import { clientScope, ValidationError, type Ctx } from "@/server/context";
import {
  INDUSTRIES, CONTACT_ROLES, COMPANY_SIZES, MAIN_NEEDS, HEARD_FROM, isValid, type Option,
} from "@/lib/onboardingOptions";
import { COUNTRIES } from "@/lib/countries";
import { cleanNeedsDetails, needsForPacks, type NeedDetails } from "@/lib/needs";
import { readChosenPack } from "@/lib/session";
import { createProjectRequest } from "@/server/services/clientActions";

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
  /** Détail de chaque besoin (JSON, voir lib/needs.ts). */
  needsDetails?: string | null;
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

function parseDetails(raw: string | null | undefined): unknown {
  if (!raw) return {};
  if (raw.length > 60_000) throw new ValidationError("Détail des besoins trop long.");
  try {
    return JSON.parse(raw);
  } catch {
    throw new ValidationError("Détail des besoins illisible.");
  }
}

/** Besoins à proposer au client selon les packs qu'il a commandés (null : tous). */
export async function clientAllowedNeeds(ctx: Ctx): Promise<string[] | null> {
  const clientId = clientScope(ctx);
  const orders = await prisma.order.findMany({
    where: { clientId, status: { not: "ANNULEE" } },
    select: { pack: { select: { code: true } } },
  });
  const codes = orders.map((o) => o.pack.code);
  if (codes.length === 0) {
    // Pas encore de commande : l'offre retenue à l'arrivée depuis le site vitrine.
    const chosen = await readChosenPack();
    if (chosen) codes.push(chosen);
  }
  return needsForPacks(codes);
}

/** Besoins et paramétrage du client connecté. */
export async function clientNeeds(ctx: Ctx): Promise<{ mainNeeds: string[]; details: NeedDetails }> {
  const clientId = clientScope(ctx);
  const c = await prisma.client.findUniqueOrThrow({ where: { id: clientId }, select: { mainNeeds: true, needsDetails: true } });
  return { mainNeeds: c.mainNeeds, details: (c.needsDetails && typeof c.needsDetails === "object" ? c.needsDetails : {}) as NeedDetails };
}

/** Le client modifie son paramétrage après l'accueil ; l'équipe est prévenue. */
export async function saveNeeds(ctx: Ctx, rawNeeds: string[], rawDetails: string) {
  const clientId = clientScope(ctx);
  const mainNeeds = cleanChoices(rawNeeds, MAIN_NEEDS, "Besoin", true);
  const needsDetails = cleanNeedsDetails(mainNeeds, parseDetails(rawDetails));
  const client = await prisma.client.update({
    where: { id: clientId },
    data: { mainNeed: mainNeeds[0]!, mainNeeds, needsDetails },
    select: { companyName: true },
  });
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });
  if (admins.length > 0) {
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        type: "DEMANDE_PROJET" as const,
        title: `Paramétrage mis à jour — ${client.companyName}`,
        body: "Le client a modifié la description de ses besoins.",
        entityType: "client",
        entityId: clientId,
      })),
    });
  }
  await merchantSiteToQuote(ctx, clientId, mainNeeds, needsDetails);
  return true;
}

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
  const needsDetails = cleanNeedsDetails(mainNeeds, parseDetails(input.needsDetails));
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
      needsDetails,
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

  await merchantSiteToQuote(ctx, clientId, mainNeeds, needsDetails);

  return true;
}

/**
 * Site marchand (notes de Sarra, §01) : il est fait sur devis, après recueil
 * des besoins et un échange avec le client — jamais payé directement.
 *   - Une demande de devis est créée avec les besoins décrits (l'équipe la voit
 *     dans « Demandes » et sur la fiche client).
 *   - Si le client a commandé le Pack Découverte UNIQUEMENT pour un site
 *     marchand (pas de site vitrine), la commande de 890 en attente est annulée :
 *     aucun paiement ne lui est demandé avant le devis.
 */
export async function merchantSiteToQuote(ctx: Ctx, clientId: bigint, mainNeeds: string[], details: NeedDetails) {
  if (!mainNeeds.includes("SITE_MARCHAND")) return { quote: false };
  const already = await prisma.projectRequest.findFirst({ where: { clientId, title: { startsWith: "Site marchand" } }, select: { id: true } });
  const d = (details.SITE_MARCHAND ?? {}) as Record<string, unknown>;
  const at = typeof d.callAt === "string" ? new Date(d.callAt) : null;
  const when = at ? new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Tunis", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(at) : null;
  const description = [
    typeof d.description === "string" ? d.description : null,
    Array.isArray(d.pages) && d.pages.length ? `Pages : ${(d.pages as string[]).join(", ")}` : null,
    when ? `Échange téléphonique réservé : ${when} (heure de Tunis).` : "Échange téléphonique à proposer avant l'envoi du devis.",
  ].filter(Boolean).join("\n");
  if (!already) {
    await createProjectRequest(ctx, { title: "Site marchand — demande de devis", description });
  }

  if (mainNeeds.includes("SITE_WEB")) return { quote: true, orderCancelled: false };
  const order = await prisma.order.findFirst({
    where: { clientId, status: "EN_ATTENTE_PAIEMENT", pack: { code: "PACK_DECOUVERTE" } },
    select: { id: true, projectId: true },
  });
  if (!order) return { quote: true, orderCancelled: false };
  const declared = await prisma.paymentProof.findFirst({ where: { orderId: order.id, status: "EN_ATTENTE" }, select: { id: true } });
  if (declared) return { quote: true, orderCancelled: false }; // virement déjà déclaré : l'équipe tranche
  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id: order.id }, data: { status: "ANNULEE" } });
    if (order.projectId) await tx.project.update({ where: { id: order.projectId }, data: { deletedAt: new Date() } });
  });
  return { quote: true, orderCancelled: true };
}
