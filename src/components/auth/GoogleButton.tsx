import styles from "@/styles/neu.module.css";

/** Logo Google officiel (4 couleurs). */
function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.400 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.2 17.7 9.5 24 9.5Z" />
      <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.2-.4-4.6H24v9.1h12.4c-.5 2.9-2.2 5.3-4.6 7l7.6 5.9c4.4-4.1 6.7-10.2 6.7-17.4Z" />
      <path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-2.9-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C1 16.3 0 20 0 24s1 7.7 2.6 10.8l7.9-6.2Z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.8 2.3-8.3 2.3-6.3 0-11.6-3.7-13.5-9.0l-7.9 6.2C6.5 42.6 14.6 48 24 48Z" />
    </svg>
  );
}

/**
 * Lien (pas un bouton de formulaire) : une navigation classique vers la route
 * qui démarre OAuth, pour ne jamais soumettre le formulaire de connexion.
 */
export function GoogleButton({ label = "Continuer avec Google" }: { label?: string }) {
  return (
    <>
      <div className={styles.divider}>ou</div>
      <a href="/api/auth/google" className={styles.googleBtn}>
        <GoogleLogo />
        {label}
      </a>
    </>
  );
}
