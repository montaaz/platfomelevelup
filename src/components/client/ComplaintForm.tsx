"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { gql } from "@/lib/gqlClient";

const CATEGORIES = [
  { value: "PRESTATION", label: "Qualité de la prestation" },
  { value: "DELAI", label: "Délai" },
  { value: "PAIEMENT", label: "Paiement par carte" },
  { value: "FACTURE", label: "Facture" },
  { value: "AUTRE", label: "Autre" },
];

const fieldCls =
  "w-full rounded-xl border border-white/70 bg-white/55 backdrop-blur-md px-4 py-3 text-[14px] outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

/** Dépôt d'une réclamation : objet, catégorie, projet concerné (facultatif), message. */
export function ComplaintForm({ projects }: { projects: { id: string; title: string }[] }) {
  const router = useRouter();
  const [category, setCategory] = useState("PRESTATION");
  const [projectId, setProjectId] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setState("busy");
    setError(null);
    try {
      await gql(
        `mutation($category: String!, $subject: String!, $message: String!, $projectId: ID) {
           createComplaint(category: $category, subject: $subject, message: $message, projectId: $projectId) { id }
         }`,
        { category, subject, message, projectId: projectId || null },
      );
      setState("sent");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur d'envoi.");
      setState("idle");
    }
  }

  if (state === "sent") {
    return (
      <section data-tilt className="glass relative rounded-2xl p-8 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-2xl">✓</span>
        <h3 className="mt-4 text-[16px] font-semibold text-ink">Réclamation enregistrée</h3>
        <p className="mx-auto mt-1.5 max-w-md text-[13.5px] text-ink/72">
          Nous en accusons réception sous 2 jours ouvrés et vous répondons sous 7 jours ouvrés. Vous suivez
          la réponse ci-dessous et par e-mail.
        </p>
        <button
          type="button"
          onClick={() => {
            setSubject("");
            setMessage("");
            setProjectId("");
            setState("idle");
          }}
          className="mt-5 text-[13px] font-medium text-brand-600 hover:text-brand-700"
        >
          Déposer une autre réclamation
        </button>
      </section>
    );
  }

  return (
    <form onSubmit={onSubmit} data-tilt className="glass relative space-y-4 rounded-2xl p-6 sm:p-7">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="category" className="mb-1.5 block text-[13px] font-medium text-ink">
            Objet de la réclamation *
          </label>
          <select id="category" value={category} onChange={(e) => setCategory(e.target.value)} className={fieldCls}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="project" className="mb-1.5 block text-[13px] font-medium text-ink">
            Projet concerné
          </label>
          <select id="project" value={projectId} onChange={(e) => setProjectId(e.target.value)} className={fieldCls}>
            <option value="">Aucun projet en particulier</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="subject" className="mb-1.5 block text-[13px] font-medium text-ink">
          Résumé en une phrase *
        </label>
        <input
          id="subject"
          required
          maxLength={200}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Ex. : La vidéo livrée ne correspond pas au brief validé"
          className={fieldCls}
        />
      </div>

      <div>
        <label htmlFor="message" className="mb-1.5 block text-[13px] font-medium text-ink">
          Décrivez le problème *
        </label>
        <textarea
          id="message"
          required
          rows={6}
          minLength={10}
          maxLength={6000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ce qui s'est passé, à quelle date, ce que vous attendez de nous. Pour un paiement : montant, date et référence de transaction si vous l'avez."
          className={fieldCls}
        />
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={state === "busy"}
        className="rounded-xl btn-3d bg-gradient-to-r from-brand-500 to-violet-500 px-6 py-3 text-[14px] font-semibold text-white shadow-lg shadow-brand-500/25 hover:opacity-95 disabled:opacity-60"
      >
        {state === "busy" ? "Envoi…" : "Envoyer la réclamation"}
      </button>
    </form>
  );
}
