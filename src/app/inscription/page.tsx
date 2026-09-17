"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./neu.module.css";

/** Œil plein, comme la référence : l'iris se remplit quand le mot de passe est visible. */
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

export default function InscriptionPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Création impossible.");
        return;
      }
      router.push(data.redirect ?? "/client");
      router.refresh();
    } catch {
      setError("Erreur réseau. Vérifiez votre connexion.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <form className={styles.card} onSubmit={onSubmit} noValidate>
        <div className={styles.badge} aria-hidden="true">✨</div>

        <h1 className={styles.title}>Create Account</h1>
        <p className={styles.subtitle}>Start your journey with us</p>

        {/* Full Name */}
        <div className={styles.field}>
          <input
            id="fullName"
            className={styles.input}
            type="text"
            placeholder=" "
            autoComplete="name"
            required
            maxLength={160}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <label className={styles.label} htmlFor="fullName">Full Name</label>
          <span className={styles.underline} />
        </div>

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
            autoComplete="new-password"
            required
            minLength={8}
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

        {/* Confirm Password */}
        <div className={styles.field}>
          <input
            id="confirmPassword"
            className={styles.input}
            type={showConfirm ? "text" : "password"}
            placeholder=" "
            autoComplete="new-password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <label className={styles.label} htmlFor="confirmPassword">Confirm Password</label>
          <button
            type="button"
            className={styles.eye}
            onClick={() => setShowConfirm((v) => !v)}
            aria-label={showConfirm ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          >
            <EyeIcon open={showConfirm} />
          </button>
          <span className={styles.underline} />
        </div>

        {error && <p className={styles.error} role="alert">{error}</p>}

        <button type="submit" className={styles.submit} disabled={loading}>
          {loading ? "CRÉATION…" : "CREATE ACCOUNT"}
        </button>

        <div className={styles.footer}>
          <span>Already have an account?</span>
          <Link href="/login" className={styles.roundLink} aria-label="Se connecter">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5m0 0 6-6m-6 6 6 6" />
            </svg>
          </Link>
        </div>
      </form>
    </main>
  );
}
