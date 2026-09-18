"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "@/styles/neu.module.css";
import { GoogleButton } from "@/components/auth/GoogleButton";

/** Œil plein : l'iris s'éclaire quand le mot de passe est visible. */
function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 5c-6.4 0-10 7-10 7s3.6 7 10 7 10-7 10-7-3.6-7-10-7Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.5" fill="currentColor" opacity={open ? 1 : 0.85} />
      {open && <circle cx="13.1" cy="10.9" r="1.15" fill="#fff" opacity="0.9" />}
    </svg>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // message renvoyé par le retour Google (?error=...)
  const oauthError = params.get("error");
  const GOOGLE_ERRORS: Record<string, string> = {
    google_indisponible: "La connexion Google n'est pas encore configurée.",
    google_annule: "Connexion Google annulée.",
    google_incomplet: "Réponse Google incomplète. Réessayez.",
    google_state: "Session expirée. Relancez la connexion Google.",
    google_erreur: "Connexion Google impossible. Réessayez.",
  };
  const shownError = error ?? (oauthError ? (GOOGLE_ERRORS[oauthError] ?? oauthError) : null);

  // offre choisie sur le site vitrine : on la transporte jusqu'à l'inscription
  const pack = params.get("pack");
  const signupHref = pack ? `/inscription?pack=${encodeURIComponent(pack)}` : "/inscription";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Connexion impossible.");
        return;
      }
      const next = params.get("next");
      router.push(next && next.startsWith("/") ? next : data.redirect);
      router.refresh();
    } catch {
      setError("Erreur réseau. Vérifiez votre connexion.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className={styles.card} onSubmit={onSubmit} noValidate>
      <div className={styles.badge} aria-hidden="true">🔐</div>

      <h1 className={styles.title}>Welcome</h1>
      <p className={styles.subtitle}>Connectez-vous pour continuer</p>

      {/* Email Address */}
      <div className={styles.field}>
        <input
          id="email"
          className={styles.input}
          type="email"
          placeholder=" "
          autoComplete="email"
          required
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label className={styles.label} htmlFor="email">Email Address</label>
        <span className={styles.underline} />
      </div>

      {/* Password */}
      <div className={styles.field}>
        <input
          id="password"
          className={styles.input}
          type={showPassword ? "text" : "password"}
          placeholder=" "
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <label className={styles.label} htmlFor="password">Password</label>
        <button
          type="button"
          className={styles.eye}
          onClick={() => setShowPassword((v) => !v)}
          aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        >
          <EyeIcon open={showPassword} />
        </button>
        <span className={styles.underline} />
      </div>

      <div className={styles.rowBetween}>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          <span className={styles.checkBox} aria-hidden="true">
            {remember && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 12.5 4.5 4.5L19 7" />
              </svg>
            )}
          </span>
          Se souvenir de moi
        </label>
      </div>

      {shownError && <p className={styles.error} role="alert">{shownError}</p>}

      <button type="submit" className={styles.submit} disabled={loading}>
        {loading ? "CONNEXION…" : "LOGIN"}
      </button>

      <GoogleButton label="Continuer avec Google" packCode={pack} />

      <div className={styles.footer}>
        <span>Pas encore de compte ?</span>
        <Link href={signupHref} className={styles.roundLink} aria-label="Créer un compte">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </Link>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className={styles.page}>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
