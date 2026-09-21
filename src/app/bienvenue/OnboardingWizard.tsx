"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/styles/neu.module.css";
import { gql } from "@/lib/gqlClient";
import {
  INDUSTRIES, CONTACT_ROLES, COMPANY_SIZES, MAIN_NEEDS, HEARD_FROM, type Option,
} from "@/lib/onboardingOptions";
import { COUNTRIES, searchCountries } from "@/lib/countries";

type Answers = {
  contactName: string;
  phoneCountry: string;
  phone: string;
  companyName: string;
  industries: string[];
  industryOther: string;
  contactRole: string;
  contactRoleOther: string;
  companySize: string;
  mainMarket: string;
  mainNeed: string;
  heardFrom: string;
  heardFromOther: string;
};

const TOTAL_STEPS = 7;

/** Liste de choix réutilisable (hors du composant pour ne pas remonter à chaque frappe). */
function Choices({
  options,
  value,
  onPick,
}: {
  options: Option[];
  value: string;
  onPick: (v: string) => void;
}) {
  return (
    <div className={styles.choices}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onPick(o.value)}
          className={`${styles.choice} ${value === o.value ? styles.choiceOn : ""}`}
          aria-pressed={value === o.value}
        >
          <span className={styles.radio} aria-hidden="true" />
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Variante à choix multiples : la case cochée se décoche, et rien n'est
 * imposé quant à l'ordre des clics. Le carré (au lieu du rond) dit d'emblée
 * que plusieurs réponses sont possibles.
 */
function MultiChoices({
  options,
  values,
  onToggle,
}: {
  options: Option[];
  values: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className={styles.choices}>
      {options.map((o) => {
        const on = values.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onToggle(o.value)}
            className={`${styles.choice} ${on ? styles.choiceOn : ""}`}
            aria-pressed={on}
          >
            <span className={`${styles.radio} ${styles.checkbox}`} aria-hidden="true" />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function OnboardingWizard({
  defaultName,
  defaultCompany,
}: {
  defaultName: string;
  defaultCompany: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countryQuery, setCountryQuery] = useState("");

  const [a, setA] = useState<Answers>({
    contactName: defaultName,
    phoneCountry: "TN",
    phone: "",
    companyName: defaultCompany,
    industries: [],
    industryOther: "",
    contactRole: "",
    contactRoleOther: "",
    companySize: "",
    mainMarket: "TN",
    mainNeed: "",
    heardFrom: "",
    heardFromOther: "",
  });

  const set = <K extends keyof Answers>(k: K, v: Answers[K]) => setA((p) => ({ ...p, [k]: v }));

  const countryResults = useMemo(() => searchCountries(countryQuery).slice(0, 60), [countryQuery]);

  /** L'étape courante est-elle complète ? (sinon le bouton reste désactivé) */
  function canContinue(): boolean {
    switch (step) {
      case 0:
        return (
          a.contactName.trim().length >= 2 &&
          a.companyName.trim().length >= 2 &&
          a.phone.replace(/\D/g, "").length >= 6
        );
      case 1:
        return a.industries.length > 0 && (!a.industries.includes("AUTRE") || a.industryOther.trim().length >= 2);
      case 2:
        return a.contactRole !== "" && (a.contactRole !== "AUTRE" || a.contactRoleOther.trim().length >= 2);
      case 3:
        return a.companySize !== "";
      case 4:
        return a.mainMarket !== "";
      case 5:
        return a.mainNeed !== "";
      case 6:
        return a.heardFrom === "" || a.heardFrom !== "AUTRE" || a.heardFromOther.trim().length >= 2;
      default:
        return false;
    }
  }

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await gql(`mutation($input: OnboardingInput!) { saveOnboarding(input: $input) }`, {
        input: {
          contactName: a.contactName,
          phoneCountry: a.phoneCountry,
          phone: a.phone,
          companyName: a.companyName,
          industries: a.industries,
          industryOther: a.industryOther || null,
          contactRole: a.contactRole,
          contactRoleOther: a.contactRoleOther || null,
          companySize: a.companySize,
          mainMarket: a.mainMarket,
          mainNeed: a.mainNeed,
          heardFrom: a.heardFrom || null,
          heardFromOther: a.heardFromOther || null,
        },
      });
      router.push("/client");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible.");
      setSaving(false);
    }
  }

  function next() {
    if (step < TOTAL_STEPS - 1) setStep((s) => s + 1);
    else void submit();
  }

  return (
    <div className={`${styles.card} ${styles.wizard}`}>
      <p className={styles.stepCount}>Étape {step + 1} sur {TOTAL_STEPS}</p>
      <div className={styles.steps} aria-hidden="true">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <span key={i} className={`${styles.stepDot} ${i <= step ? styles.stepDotOn : ""}`} />
        ))}
      </div>

      {/* 0 — informations de base */}
      {step === 0 && (
        <>
          <h2 className={styles.question}>Vos informations</h2>
          <p className={styles.hint}>Pour que l&apos;équipe sache qui vous êtes.</p>

          <div className={styles.field}>
            <input
              id="contactName"
              className={styles.input}
              placeholder=" "
              value={a.contactName}
              onChange={(e) => set("contactName", e.target.value)}
              maxLength={160}
            />
            <label className={styles.label} htmlFor="contactName">Nom et prénom</label>
            <span className={styles.underline} />
          </div>

          <div className={styles.field}>
            <input
              id="companyName"
              className={styles.input}
              placeholder=" "
              value={a.companyName}
              onChange={(e) => set("companyName", e.target.value)}
              maxLength={160}
            />
            <label className={styles.label} htmlFor="companyName">Nom de l&apos;entreprise</label>
            <span className={styles.underline} />
          </div>

          <div className={styles.phoneRow}>
            <select
              className={styles.dialSelect}
              value={a.phoneCountry}
              onChange={(e) => set("phoneCountry", e.target.value)}
              aria-label="Indicatif pays"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.dial} {c.code}</option>
              ))}
            </select>
            <div className={styles.field}>
              <input
                id="phone"
                className={styles.input}
                type="tel"
                placeholder=" "
                value={a.phone}
                onChange={(e) => set("phone", e.target.value)}
                maxLength={20}
              />
              <label className={styles.label} htmlFor="phone">Téléphone</label>
              <span className={styles.underline} />
            </div>
          </div>
        </>
      )}

      {/* 1 — secteur d'activité */}
      {step === 1 && (
        <>
          <h2 className={styles.question}>Votre secteur d&apos;activité</h2>
          <p className={styles.hint}>
            Plusieurs réponses possibles — cochez tout ce qui vous correspond.
          </p>
          <MultiChoices
            options={INDUSTRIES}
            values={a.industries}
            onToggle={(v) =>
              set(
                "industries",
                a.industries.includes(v) ? a.industries.filter((x) => x !== v) : [...a.industries, v],
              )
            }
          />
          {a.industries.includes("AUTRE") && (
            <div className={styles.field}>
              <input
                id="industryOther"
                className={styles.input}
                placeholder=" "
                value={a.industryOther}
                onChange={(e) => set("industryOther", e.target.value)}
                maxLength={160}
              />
              <label className={styles.label} htmlFor="industryOther">Précisez votre secteur</label>
              <span className={styles.underline} />
            </div>
          )}
        </>
      )}

      {/* 2 — fonction du contact */}
      {step === 2 && (
        <>
          <h2 className={styles.question}>Votre fonction</h2>
          <p className={styles.hint}>Qui sommes-nous en train d&apos;accompagner ?</p>
          <Choices options={CONTACT_ROLES} value={a.contactRole} onPick={(v) => set("contactRole", v)} />
          {a.contactRole === "AUTRE" && (
            <div className={styles.field}>
              <input
                id="roleOther"
                className={styles.input}
                placeholder=" "
                value={a.contactRoleOther}
                onChange={(e) => set("contactRoleOther", e.target.value)}
                maxLength={160}
              />
              <label className={styles.label} htmlFor="roleOther">Précisez votre fonction</label>
              <span className={styles.underline} />
            </div>
          )}
        </>
      )}

      {/* 3 — taille de l'entreprise */}
      {step === 3 && (
        <>
          <h2 className={styles.question}>Taille de l&apos;entreprise</h2>
          <p className={styles.hint}>Pour vous proposer la formule la plus adaptée.</p>
          <Choices options={COMPANY_SIZES} value={a.companySize} onPick={(v) => set("companySize", v)} />
        </>
      )}

      {/* 4 — marché principal, avec recherche */}
      {step === 4 && (
        <>
          <h2 className={styles.question}>Votre marché principal</h2>
          <p className={styles.hint}>Tapez les premières lettres pour filtrer.</p>
          <div className={styles.searchWrap}>
            <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4-4" />
            </svg>
            <input
              className={styles.searchInput}
              placeholder="Rechercher un pays…"
              value={countryQuery}
              onChange={(e) => setCountryQuery(e.target.value)}
              aria-label="Rechercher un pays"
            />
          </div>
          <div className={styles.choices}>
            {countryResults.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => set("mainMarket", c.code)}
                className={`${styles.choice} ${a.mainMarket === c.code ? styles.choiceOn : ""}`}
                aria-pressed={a.mainMarket === c.code}
              >
                <span className={styles.radio} aria-hidden="true" />
                {c.name}
              </button>
            ))}
            {countryResults.length === 0 && <p className={styles.empty}>Aucun pays trouvé.</p>}
          </div>
        </>
      )}

      {/* 5 — besoin principal */}
      {step === 5 && (
        <>
          <h2 className={styles.question}>Votre besoin principal</h2>
          <p className={styles.hint}>Nous vous orientons vers le bon service.</p>
          <Choices options={MAIN_NEEDS} value={a.mainNeed} onPick={(v) => set("mainNeed", v)} />
        </>
      )}

      {/* 6 — origine (facultatif) */}
      {step === 6 && (
        <>
          <h2 className={styles.question}>Comment nous avez-vous connu ?</h2>
          <p className={styles.hint}>Facultatif — vous pouvez terminer sans répondre.</p>
          <Choices options={HEARD_FROM} value={a.heardFrom} onPick={(v) => set("heardFrom", v)} />
          {a.heardFrom === "AUTRE" && (
            <div className={styles.field}>
              <input
                id="heardOther"
                className={styles.input}
                placeholder=" "
                value={a.heardFromOther}
                onChange={(e) => set("heardFromOther", e.target.value)}
                maxLength={160}
              />
              <label className={styles.label} htmlFor="heardOther">Précisez</label>
              <span className={styles.underline} />
            </div>
          )}
        </>
      )}

      {error && <p className={styles.error} role="alert">{error}</p>}

      <div className={styles.actions}>
        {step > 0 && (
          <button type="button" className={styles.back} onClick={() => setStep((s) => s - 1)} disabled={saving}>
            Retour
          </button>
        )}
        <button
          type="button"
          className={`${styles.submit} ${styles.grow}`}
          onClick={next}
          disabled={!canContinue() || saving}
        >
          {saving ? "ENREGISTREMENT…" : step === TOTAL_STEPS - 1 ? "TERMINER" : "CONTINUER"}
        </button>
      </div>
    </div>
  );
}
