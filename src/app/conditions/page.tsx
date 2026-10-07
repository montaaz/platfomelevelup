import Link from "next/link";
import styles from "@/styles/neu.module.css";
import { TERMS_FR, PUBLISHER } from "@/content/legal";

export const metadata = { title: "Conditions générales d'utilisation et de vente" };

/**
 * Les conditions acceptées à la création du compte, lisibles sans connexion :
 * le lien de la case « J'accepte » mène ici.
 */
export default function ConditionsPage() {
  return (
    <main className={styles.page} style={{ alignItems: "flex-start", paddingTop: 40, paddingBottom: 60 }}>
      <article className={styles.card} style={{ maxWidth: 760, textAlign: "left", cursor: "default" }}>
        <h1 className={styles.title} style={{ textAlign: "left" }}>{TERMS_FR.title}</h1>
        <p className={styles.hint} style={{ marginTop: 4 }}>{TERMS_FR.updated}</p>
        <p style={{ marginTop: 16, fontSize: 14.5, lineHeight: 1.65, color: "#4b5567" }}>{TERMS_FR.intro}</p>
        {TERMS_FR.sections.map((s) => (
          <section key={s.heading} style={{ marginTop: 22 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "#26303f", marginBottom: 8 }}>{s.heading}</h2>
            {s.paragraphs.map((p, i) => (
              <p key={i} style={{ fontSize: 13.5, lineHeight: 1.7, color: "#4b5567", marginBottom: 8 }}>{p}</p>
            ))}
          </section>
        ))}
        <p style={{ marginTop: 28, paddingTop: 16, borderTop: "1px solid #dde3ee", fontSize: 13, color: "#6b7689" }}>
          Contact : <a href={`mailto:${PUBLISHER.email}`} style={{ color: "#0a5ff0", fontWeight: 600 }}>{PUBLISHER.email}</a>
          {" · "}Version complète (français et anglais) : <a href={`${PUBLISHER.site}/fr/conditions`} style={{ color: "#0a5ff0", fontWeight: 600 }}>{PUBLISHER.site}/fr/conditions</a>
        </p>
        <Link href="/inscription" className={styles.back} style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 22 }}>
          Retour à l&apos;inscription
        </Link>
      </article>
    </main>
  );
}
