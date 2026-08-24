"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-[13px] font-medium text-ink">
          Adresse e-mail
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-ink/10 bg-white px-4 py-3 text-[14px] outline-none placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          placeholder="vous@entreprise.tn"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-[13px] font-medium text-ink">
          Mot de passe
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-ink/10 bg-white px-4 py-3 text-[14px] outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          placeholder="••••••••"
        />
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-600" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-gradient-to-r from-brand-500 to-violet-500 py-3 text-[14px] font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:opacity-95 disabled:opacity-60"
      >
        {loading ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="hero-gradient flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="text-3xl font-extrabold tracking-wide text-white">
            LEVEL UP<span className="brand-text-gradient"> IA</span>
          </span>
          <p className="mt-1 text-[11px] font-medium tracking-[0.2em] text-white/50 uppercase">
            Digital marketing powered by AI
          </p>
        </div>

        <div className="rounded-3xl bg-white p-8 shadow-hero">
          <h1 className="text-lg font-bold text-ink">Connexion</h1>
          <p className="mt-1 mb-6 text-[13px] text-slate-500">
            Accédez à votre espace client ou à l'espace d'administration.
          </p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-[12px] text-white/40">
          © {new Date().getFullYear()} Level Up IA — Tous droits réservés
        </p>
      </div>
    </main>
  );
}
