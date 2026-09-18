/**
 * Catalogue des réponses du questionnaire d'accueil.
 * Source unique : le formulaire client, la validation serveur et la fiche admin
 * lisent tous ces listes — les libellés ne peuvent donc jamais diverger.
 * La valeur stockée en base est la clé (stable) ; le libellé peut évoluer.
 */

export type Option = { value: string; label: string };

export const INDUSTRIES: Option[] = [
  { value: "ECOMMERCE", label: "E-commerce / Vente en ligne" },
  { value: "RETAIL", label: "Commerce de détail / Retail" },
  { value: "RESTAURATION", label: "Restauration / Food & Beverage" },
  { value: "MODE_BEAUTE", label: "Mode / Beauté / Cosmétique" },
  { value: "IMMOBILIER", label: "Immobilier" },
  { value: "SANTE", label: "Santé / Bien-être" },
  { value: "EDUCATION", label: "Éducation / Formation" },
  { value: "TECH", label: "Technologie / SaaS / Startup" },
  { value: "INDUSTRIE", label: "Industrie / Fabrication" },
  { value: "BTP", label: "BTP / Construction" },
  { value: "AUTOMOBILE", label: "Automobile" },
  { value: "TOURISME", label: "Tourisme / Hôtellerie / Événementiel" },
  { value: "FINANCE", label: "Finance / Assurance / Services professionnels" },
  { value: "ARTISANAT", label: "Artisanat / Fait-main" },
  { value: "AGROALIMENTAIRE", label: "Agroalimentaire" },
  { value: "SPORT", label: "Sport / Fitness" },
  { value: "ASSOCIATION", label: "Association / ONG" },
  { value: "AUTRE", label: "Autre" },
];

export const CONTACT_ROLES: Option[] = [
  { value: "FONDATEUR", label: "Fondateur / Fondatrice" },
  { value: "CEO", label: "Directeur(trice) Général(e) / CEO" },
  { value: "MARKETING", label: "Responsable Marketing" },
  { value: "COMMUNICATION", label: "Responsable Communication" },
  { value: "COMMERCIAL", label: "Responsable Commercial" },
  { value: "GERANT", label: "Gérant(e) / Propriétaire (TPE/indépendant)" },
  { value: "ASSISTANT", label: "Assistant(e) / Chargé(e) de projet" },
  { value: "FREELANCE", label: "Freelance / Consultant(e)" },
  { value: "AUTRE", label: "Autre" },
];

export const COMPANY_SIZES: Option[] = [
  { value: "INDEPENDANT", label: "Indépendant / Auto-entrepreneur" },
  { value: "2_10", label: "2 à 10 employés" },
  { value: "11_50", label: "11 à 50 employés" },
  { value: "51_200", label: "51 à 200 employés" },
  { value: "200_PLUS", label: "Plus de 200 employés" },
];

export const MAIN_NEEDS: Option[] = [
  { value: "SITE_WEB", label: "Créer un site web" },
  { value: "SHOOTING", label: "Shooting produits" },
  { value: "VIDEOS", label: "Vidéos pour réseaux sociaux" },
  { value: "PUBLICITE", label: "Gestion de campagnes publicitaires" },
  { value: "IDENTITE", label: "Identité visuelle (logo, charte)" },
  { value: "CHATBOT", label: "Chatbot / Automatisation" },
  { value: "CONSEIL", label: "Je ne sais pas encore / Besoin d'un conseil" },
];

export const HEARD_FROM: Option[] = [
  { value: "RESEAUX", label: "Réseaux sociaux (Instagram/Facebook/LinkedIn)" },
  { value: "RECOMMANDATION", label: "Recommandation" },
  { value: "GOOGLE", label: "Recherche Google" },
  { value: "CLIENT_LEVELUP", label: "Client existant de Level Up" },
  { value: "AUTRE", label: "Autre" },
];

/** Libellé affichable depuis la valeur stockée (fiche admin). */
export function labelOf(list: Option[], value: string | null | undefined): string | null {
  if (!value) return null;
  return list.find((o) => o.value === value)?.label ?? value;
}

export const isValid = (list: Option[], value: string) => list.some((o) => o.value === value);
