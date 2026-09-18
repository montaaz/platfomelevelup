import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCtx, ForbiddenError } from "@/server/context";
import { adminClientDetail } from "@/server/services/adminActions";
import { Card, CardHeader, StatusBadge, Avatar, EmptyState } from "@/components/ui";
import {
  formatDT, formatDateFull, formatDateShort,
  PROJECT_STATUS_LABEL, INVOICE_STATUS_LABEL,
} from "@/lib/format";
import {
  INDUSTRIES, CONTACT_ROLES, COMPANY_SIZES, MAIN_NEEDS, HEARD_FROM, labelOf,
} from "@/lib/onboardingOptions";
import { countryByCode, countryFlag } from "@/lib/countries";

export const dynamic = "force-dynamic";

/** Une ligne « libellé → valeur » de la fiche. */
function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-ink/5 px-4 py-2.5 last:border-0 sm:px-6">
      <span className="text-[12.5px] text-ink/60">{label}</span>
      <span className="text-[13.5px] font-medium text-ink">{value ?? "—"}</span>
    </div>
  );
}

export default async function AdminClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCtx("ADMIN");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  let c: Awaited<ReturnType<typeof adminClientDetail>>;
  try {
    c = await adminClientDetail(ctx, BigInt(id));
  } catch (e) {
    if (e instanceof ForbiddenError) notFound();
    throw e;
  }

  const ob = c.onboarding;
  const industry = ob.industry === "AUTRE" ? ob.industryOther : labelOf(INDUSTRIES, ob.industry);
  const role = ob.contactRole === "AUTRE" ? ob.contactRoleOther : labelOf(CONTACT_ROLES, ob.contactRole);
  const heard = ob.heardFrom === "AUTRE" ? ob.heardFromOther : labelOf(HEARD_FROM, ob.heardFrom);
  const market = countryByCode(ob.mainMarket)?.name ?? ob.mainMarket;

  const unpaid = c.invoices
    .filter((i) => i.status === "EN_ATTENTE" || i.status === "EN_RETARD")
    .reduce((s, i) => s + i.total, 0);
  const paid = c.invoices.filter((i) => i.status === "PAYEE").reduce((s, i) => s + i.total, 0);

  return (
    <div className="space-y-5 pb-8">
      {/* bandeau */}
      <section data-tilt className="hero-gradient rounded-3xl p-6 text-white shadow-hero sm:p-7">
        <Link href="/admin/clients" className="text-[12.5px] font-medium text-white/82 hover:text-white">
          ← Tous les clients
        </Link>
        <div className="mt-2 flex items-center gap-3.5">
          <Avatar name={c.companyName} size={46} />
          <div className="min-w-0">
            <h2 className="truncate text-[19px] font-semibold">{c.companyName}</h2>
            <p className="truncate text-[12.5px] text-white/80">
              {c.contactName}
              {c.city ? ` · ${c.city}` : ""}
              {` · client depuis le ${formatDateShort(c.createdAt)}`}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-6">
          <div className="glass-dark kpi-tile rounded-2xl p-3 sm:p-4">
            <p className="text-[12px] text-white/80">Projets</p>
            <p className="mt-1 text-[22px] leading-none font-bold sm:text-[28px]">{c.projects.length}</p>
          </div>
          <div className="glass-dark kpi-tile rounded-2xl p-3 sm:p-4">
            <p className="text-[12px] text-white/80">Encaissé</p>
            <p className="mt-1 text-[22px] leading-none font-bold sm:text-[28px]">{formatDT(paid)}</p>
          </div>
          <div className="glass-dark kpi-tile rounded-2xl p-3 sm:p-4">
            <p className="text-[12px] text-white/80">Impayé</p>
            <p className="mt-1 text-[22px] leading-none font-bold sm:text-[28px]">{formatDT(unpaid)}</p>
          </div>
        </div>
      </section>

      <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          {/* Questionnaire d'accueil */}
          <Card>
            <CardHeader
              title="Profil client"
              subtitle={
                ob.completedAt
                  ? `Questionnaire rempli le ${formatDateFull(ob.completedAt)}`
                  : "Questionnaire pas encore rempli par le client"
              }
            />
            {ob.completedAt ? (
              <div>
                <Row label="Secteur d'activité" value={industry} />
                <Row label="Fonction du contact" value={role} />
                <Row label="Taille de l'entreprise" value={labelOf(COMPANY_SIZES, ob.companySize)} />
                <Row label="Marché principal" value={market} />
                <Row label="Besoin principal" value={labelOf(MAIN_NEEDS, ob.mainNeed)} />
                <Row label="Nous a connus par" value={heard} />
              </div>
            ) : (
              <EmptyState message="Le client verra le questionnaire à sa prochaine connexion." />
            )}
          </Card>

          {/* Projets */}
          <Card>
            <CardHeader title="Projets" subtitle={`${c.projects.length} au total`} action={{ label: "Tous les projets", href: "/admin/projets" }} />
            <div className="divide-y divide-ink/4 pb-2">
              {c.projects.length === 0 && <EmptyState message="Aucun projet." />}
              {c.projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/admin/projets/${p.id}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 hover:bg-white/40 sm:px-6"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-semibold text-ink">{p.title}</span>
                    <span className="block text-[12px] text-ink/60">{p.serviceName}</span>
                  </span>
                  <StatusBadge status={p.status} label={PROJECT_STATUS_LABEL[p.status] ?? p.status} />
                  <span className="text-[13px] font-semibold whitespace-nowrap">{formatDT(p.price)}</span>
                </Link>
              ))}
            </div>
          </Card>

          {/* Factures */}
          <Card>
            <CardHeader title="Factures" subtitle={`${c.invoices.length} émise(s)`} />
            <div className="divide-y divide-ink/4 pb-2">
              {c.invoices.length === 0 && <EmptyState message="Aucune facture." />}
              {c.invoices.map((i) => (
                <Link
                  key={i.id}
                  href={`/admin/factures/${i.id}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 hover:bg-white/40 sm:px-6"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-medium text-ink">{i.number}</span>
                    <span className="block text-[12px] text-ink/60">{formatDateFull(i.issueDate)}</span>
                  </span>
                  <StatusBadge status={i.status} label={INVOICE_STATUS_LABEL[i.status] ?? i.status} />
                  <span className="text-[13px] font-semibold whitespace-nowrap">{formatDT(i.total, { decimals: 2 })}</span>
                </Link>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          {/* Coordonnées */}
          <Card>
            <CardHeader title="Coordonnées" />
            <div>
              <Row label="Contact" value={c.contactName} />
              <Row label="E-mail" value={c.email} />
              <Row label="Téléphone" value={c.phone} />
              <Row label="Adresse" value={c.address} />
              <Row label="Ville" value={c.city} />
              <Row label="Pays" value={c.country} />
              <Row label="Matricule fiscal" value={c.taxId} />
            </div>

            {/* Provenance relevée à la connexion, utile tant que l'adresse manque. */}
            {c.detected.name && (
              <div className="mx-4 mb-4 rounded-2xl bg-ink/3 px-4 py-3 sm:mx-6">
                <p className="flex items-center gap-2 text-[12.5px] font-semibold text-ink/80">
                  <span className="text-[15px] leading-none">{countryFlag(c.detected.code)}</span>
                  Connexion depuis : {c.detected.name}
                </p>
                <p className="mt-1 text-[11.5px] text-ink/55">
                  {c.profileComplete
                    ? "Le pays de la fiche fait foi ; cette information vient du réseau."
                    : "Adresse non renseignée — ce pays est déduit du réseau du client."}
                </p>
              </div>
            )}
          </Card>

          {/* Comptes de connexion */}
          <Card>
            <CardHeader title="Comptes de connexion" />
            <div className="divide-y divide-ink/4 pb-2">
              {c.accounts.length === 0 && <EmptyState message="Aucun compte." />}
              {c.accounts.map((u) => (
                <div key={u.email} className="px-4 py-3 sm:px-6">
                  <p className="truncate text-[13px] font-medium text-ink">{u.email}</p>
                  <p className="text-[11.5px] text-ink/60">
                    {u.isActive ? "Actif" : "Désactivé"} ·{" "}
                    {u.lastLoginAt ? `vu le ${formatDateFull(u.lastLoginAt)}` : "jamais connecté"}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          {/* Abonnements */}
          {c.subscriptions.length > 0 && (
            <Card>
              <CardHeader title="Abonnements" />
              <div className="divide-y divide-ink/4 pb-2">
                {c.subscriptions.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 sm:px-6">
                    <span className="flex-1 text-[13px] font-medium text-ink">{s.planName}</span>
                    <span className="text-[13px] font-semibold">{formatDT(s.monthlyAmount)}/mois</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {c.notes && (
            <Card>
              <CardHeader title="Notes internes" />
              <p className="px-4 pb-5 text-[13px] whitespace-pre-wrap text-ink/82 sm:px-6">{c.notes}</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
