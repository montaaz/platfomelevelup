import { prisma } from "@/lib/prisma";
import { assertAdmin, type Ctx } from "@/server/context";
import { countryCodeFromName, countryName, detectCountryFromRequest, PENDING_COUNTRY } from "@/lib/countries";

/**
 * Provenance géographique des clients.
 *
 * Deux sources, dans cet ordre de confiance :
 *   1. le pays saisi par le client dans son profil — il fait foi ;
 *   2. le pays détecté par le réseau — utilisé tant que le profil est vide.
 *
 * Le pays détecté n'écrase jamais une saisie : il la complète.
 */

/** Pays retenu pour un client, saisie prioritaire sur détection. */
export function effectiveCountry(client: {
  country: string | null;
  detectedCountry: string | null;
  detectedCountryCode: string | null;
}): { code: string | null; name: string | null; fromProfile: boolean } {
  if (client.country?.trim()) {
    return {
      code: countryCodeFromName(client.country),
      name: client.country.trim(),
      fromProfile: true,
    };
  }
  return {
    code: client.detectedCountryCode ?? null,
    name: client.detectedCountry ?? null,
    fromProfile: false,
  };
}

/**
 * Enregistre le pays détecté à la connexion, et prévient le client si son
 * adresse manque encore.
 *
 * Volontairement silencieuse : une détection impossible ne doit jamais
 * empêcher quelqu'un de se connecter.
 */
export async function recordDetectedCountry(
  clientId: bigint,
  headers: Headers | { get(name: string): string | null },
  userId?: bigint,
) {
  try {
    const hit = detectCountryFromRequest(headers);
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, address: true, country: true, detectedCountryCode: true },
    });
    if (!client) return;

    if (hit && hit.code !== client.detectedCountryCode) {
      await prisma.client.update({
        where: { id: clientId },
        data: {
          detectedCountryCode: hit.code,
          detectedCountry: hit.name,
          detectedAt: new Date(),
          detectedSource: hit.source,
        },
      });
    }

    if (userId) await notifyIncompleteProfile(clientId, userId);
  } catch (e) {
    console.error("[geo] détection ignorée:", e);
  }
}

/**
 * Alerte « complétez votre profil » dans la cloche du client.
 *
 * Posée une seule fois par période de 7 jours tant que l'adresse manque, pour
 * rappeler sans harceler.
 */
export async function notifyIncompleteProfile(clientId: bigint, userId: bigint) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { address: true, city: true, country: true },
  });
  if (!client) return;

  const complete = Boolean(client.address?.trim() && client.country?.trim());
  if (complete) return;

  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const recent = await prisma.notification.findFirst({
    where: { userId, type: "PROFIL_INCOMPLET", createdAt: { gte: weekAgo } },
    select: { id: true },
  });
  if (recent) return;

  await prisma.notification.create({
    data: {
      userId,
      type: "PROFIL_INCOMPLET",
      title: "Complétez votre profil",
      body: "Renseignez votre adresse et votre pays pour que vos factures soient établies correctement.",
      entityType: "client",
      entityId: clientId,
    },
  });
}

export { PENDING_COUNTRY };

export type CountryRow = {
  code: string | null;
  name: string;
  flag: string;
  clients: number;
  /** Clients dont le pays vient d'une saisie et non d'une détection. */
  confirmed: number;
};

/**
 * Répartition des clients par pays, pour le sélecteur du tableau de bord.
 *
 * Le regroupement est fait en base : `COALESCE` retient la saisie quand elle
 * existe, sinon la détection.
 */
export async function countriesOverview(ctx: Ctx): Promise<CountryRow[]> {
  assertAdmin(ctx);

  const rows = await prisma.$queryRaw<
    { code: string | null; label: string | null; clients: bigint; confirmed: bigint }[]
  >`
    SELECT
      CASE WHEN NULLIF(btrim(c.country), '') IS NOT NULL
           THEN NULL ELSE c.detected_country_code END       AS code,
      COALESCE(NULLIF(btrim(c.country), ''), c.detected_country) AS label,
      COUNT(*)                                              AS clients,
      COUNT(*) FILTER (WHERE NULLIF(btrim(c.country), '') IS NOT NULL) AS confirmed
    FROM clients c
    WHERE c.deleted_at IS NULL AND c.is_active = true
    GROUP BY 1, 2
    ORDER BY clients DESC, label NULLS LAST`;

  // Un même pays peut arriver en deux lignes (saisi ici, détecté là) : on les
  // réunit sous le nom français.
  const merged = new Map<string, CountryRow>();
  for (const r of rows) {
    // Ni saisie ni détection : le pays sera connu à la prochaine connexion du
    // client. On le dit plutôt que d'afficher « inconnu », qui ferait croire
    // à une anomalie.
    const name = r.label?.trim() || countryName(r.code) || PENDING_COUNTRY;
    const key = name.toLowerCase();
    const code = r.code ?? countryCodeFromName(name);
    const existing = merged.get(key);
    if (existing) {
      existing.clients += Number(r.clients);
      existing.confirmed += Number(r.confirmed);
      existing.code ??= code;
    } else {
      merged.set(key, {
        code,
        name,
        flag: "",
        clients: Number(r.clients),
        confirmed: Number(r.confirmed),
      });
    }
  }

  return [...merged.values()].sort((a, b) => b.clients - a.clients || a.name.localeCompare(b.name, "fr"));
}

/**
 * Traduit un pays choisi dans le sélecteur en filtre Prisma sur `client`.
 *
 * Le nom arrive de l'URL : il n'est jamais interpolé dans du SQL, seulement
 * comparé en paramètre.
 */
export function clientCountryFilter(country: string | null) {
  if (!country?.trim()) return {};
  const name = country.trim();
  // Cas particulier : les clients sans pays connu, ni saisi ni détecté.
  if (name === PENDING_COUNTRY) {
    return {
      AND: [
        { OR: [{ country: null }, { country: "" }] },
        { OR: [{ detectedCountry: null }, { detectedCountry: "" }] },
      ],
    };
  }
  return {
    OR: [
      { country: { equals: name, mode: "insensitive" as const } },
      {
        AND: [
          { OR: [{ country: null }, { country: "" }] },
          { detectedCountry: { equals: name, mode: "insensitive" as const } },
        ],
      },
    ],
  };
}
