"use client";

import styles from "@/styles/neu.module.css";
import { MAIN_NEEDS } from "@/lib/onboardingOptions";
import { CONTACT_MAILTO, NEED_SPECS, PAGES, PALETTES, STYLES, type NeedDetails } from "@/lib/needs";

/**
 * L'étape « Vos besoins » : la liste des besoins ; sous chaque besoin coché,
 * son sous-formulaire (description, pages, palette, style, mood…).
 * Réutilisé tel quel pour modifier le paramétrage plus tard (/client/besoins).
 */
export function NeedsForm({
  mainNeeds,
  details,
  onChange,
}: {
  mainNeeds: string[];
  details: NeedDetails;
  onChange: (mainNeeds: string[], details: NeedDetails) => void;
}) {
  const toggleNeed = (v: string) =>
    onChange(mainNeeds.includes(v) ? mainNeeds.filter((x) => x !== v) : [...mainNeeds, v], details);
  const setField = (need: string, key: string, value: string | string[] | boolean) =>
    onChange(mainNeeds, { ...details, [need]: { ...(details[need] ?? {}), [key]: value } });
  const toggleIn = (need: string, key: string, v: string) => {
    const cur = (details[need]?.[key] as string[] | undefined) ?? [];
    setField(need, key, cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]);
  };

  return (
    <div className={styles.choices}>
      {MAIN_NEEDS.map((o) => {
        const on = mainNeeds.includes(o.value);
        const spec = NEED_SPECS[o.value];
        const d = details[o.value] ?? {};
        return (
          <div key={o.value} className={styles.needRow}>
            <button type="button" onClick={() => toggleNeed(o.value)} className={`${styles.choice} ${on ? styles.choiceOn : ""}`} aria-pressed={on}>
              <span className={`${styles.radio} ${styles.checkbox}`} aria-hidden="true" />
              {o.label}
            </button>

            {on && spec && (
              <div className={styles.sub}>
                <p className={styles.subTitle}>{spec.title}</p>
                <p className={styles.subHint}>{spec.hint}</p>

                {spec.fields.map((f) => {
                  if (f.kind === "text") {
                    return (
                      <div key={f.key}>
                        <label className={styles.fieldLabel} htmlFor={`${o.value}-${f.key}`}>
                          {f.label}{f.required ? " *" : ""}
                        </label>
                        <textarea
                          id={`${o.value}-${f.key}`}
                          className={styles.textarea}
                          placeholder={f.placeholder}
                          maxLength={2000}
                          rows={3}
                          value={(d[f.key] as string) ?? ""}
                          onChange={(e) => setField(o.value, f.key, e.target.value)}
                        />
                      </div>
                    );
                  }
                  if (f.kind === "pages" || f.kind === "styles") {
                    const list = f.kind === "pages" ? PAGES : STYLES;
                    const cur = (d[f.key] as string[] | undefined) ?? [];
                    return (
                      <div key={f.key}>
                        <p className={styles.fieldLabel}>{f.label}</p>
                        <div className={f.kind === "pages" ? styles.grid : styles.grid3}>
                          {list.map((p) => (
                            <button key={p.value} type="button" onClick={() => toggleIn(o.value, f.key, p.value)} className={`${styles.tick} ${cur.includes(p.value) ? styles.tickOn : ""}`} aria-pressed={cur.includes(p.value)}>
                              <span className={styles.tickBox} aria-hidden="true" />
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  if (f.kind === "palette") {
                    return (
                      <div key={f.key}>
                        <p className={styles.fieldLabel}>{f.label}</p>
                        <div className={styles.grid3}>
                          {PALETTES.map((p) => (
                            <button key={p.value} type="button" onClick={() => setField(o.value, f.key, d[f.key] === p.value ? "" : p.value)} className={`${styles.tick} ${styles.tickRound} ${d[f.key] === p.value ? styles.tickOn : ""}`} aria-pressed={d[f.key] === p.value}>
                              <span className={styles.tickBox} aria-hidden="true" />
                              <span className={styles.swatches} aria-hidden="true">
                                {p.colors.map((c) => <span key={c} className={styles.swatch} style={{ background: c }} />)}
                              </span>
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  if (f.kind === "call") {
                    const want = d[f.key] === true;
                    return (
                      <div key={f.key} className={styles.callBox}>
                        <p className={styles.callTitle}>Planifier un échange téléphonique</p>
                        <button type="button" onClick={() => setField(o.value, f.key, !want)} className={`${styles.tick} ${styles.tickRound} ${want ? styles.tickOn : ""}`} aria-pressed={want} style={{ width: "100%", justifyContent: "center" }}>
                          <span className={styles.tickBox} aria-hidden="true" />
                          {f.label}
                        </button>
                        <p className={styles.callHint}>{f.hint}</p>
                      </div>
                    );
                  }
                  return null;
                })}

                <p className={styles.note}>{spec.attachNote}</p>
                <div className={styles.mailRow}>
                  <a href={CONTACT_MAILTO} className={styles.mailBtn}>✉ Nous contacter par e-mail</a>
                  <span style={{ fontSize: 11.5, color: "#6b7689" }}>contact@levelupia.agency</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
