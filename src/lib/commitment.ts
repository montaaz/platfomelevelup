/**
 * Promotions des abonnements, reprises de la grille tarifaire du site
 * (notes de Sarra, §02) : un mois offert pour un engagement de six mois,
 * deux mois offerts pour un an. Le client paie les mois non offerts d'avance.
 */
export type Commitment = { months: 1 | 6 | 12; free: number; label: string; promo: string | null };

export const COMMITMENTS: Commitment[] = [
  { months: 1, free: 0, label: "Mensuel", promo: null },
  { months: 6, free: 1, label: "6 mois", promo: "1 mois offert" },
  { months: 12, free: 2, label: "12 mois", promo: "2 mois offerts" },
];

export function commitmentFor(months: number | null | undefined): Commitment {
  return COMMITMENTS.find((c) => c.months === months) ?? COMMITMENTS[0]!;
}

/** Montant à régler pour un engagement : prix mensuel × mois payés (mois offerts déduits). */
export function commitmentAmount(monthly: number, months: number): number {
  const c = commitmentFor(months);
  return Math.round(monthly * (c.months - c.free) * 1000) / 1000;
}
