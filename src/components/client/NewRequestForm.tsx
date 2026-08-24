"use client";

import { useState, type FormEvent } from "react";

export function NewRequestForm({ services }: { services: { id: string; name: string }[] }) {
  const [title, setTitle] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [description, setDescription] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setState("busy");
    setError(null);
    try {
      const res = await fetch("/api/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `mutation($title: String!, $description: String!, $serviceId: ID) {
            createProjectRequest(title: $title, description: $description, serviceId: $serviceId) { id }
          }`,
          variables: { title, description, serviceId: serviceId || null },
        }),
      });
      const json = await res.json();
      if (json.errors?.length) throw new Error(json.errors[0].message);
      setState("sent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur d'envoi.");
      setState("idle");
    }
  }

  if (state === "sent") {
    return (
      <section className="rounded-2xl border border-ink/5 bg-white p-8 text-center shadow-card">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-2xl">✓</span>
        <h3 className="mt-4 text-[16px] font-semibold text-ink">Demande envoyée</h3>
        <p className="mx-auto mt-1.5 max-w-md text-[13.5px] text-slate-500">
          L&apos;équipe a bien reçu votre demande et revient vers vous rapidement. Vous serez notifié dès qu&apos;une
          réponse est disponible.
        </p>
      </section>
    );
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4 rounded-2xl border border-ink/5 bg-white p-6 shadow-card sm:p-7">
      <div>
        <label htmlFor="title" className="mb-1.5 block text-[13px] font-medium text-ink">
          Titre de votre demande *
        </label>
        <input
          id="title"
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex. : Vidéo de présentation du nouveau produit"
          className="w-full rounded-xl border border-ink/10 px-4 py-3 text-[14px] outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
      </div>

      <div>
        <label htmlFor="service" className="mb-1.5 block text-[13px] font-medium text-ink">
          Service concerné
        </label>
        <select
          id="service"
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
          className="w-full rounded-xl border border-ink/10 bg-white px-4 py-3 text-[14px] outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        >
          <option value="">Je ne sais pas encore</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="description" className="mb-1.5 block text-[13px] font-medium text-ink">
          Décrivez votre besoin *
        </label>
        <textarea
          id="description"
          required
          rows={5}
          maxLength={4000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Objectif, délais souhaités, budget indicatif, exemples qui vous plaisent…"
          className="w-full rounded-xl border border-ink/10 px-4 py-3 text-[14px] outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={state === "busy"}
        className="rounded-xl bg-gradient-to-r from-brand-500 to-violet-500 px-6 py-3 text-[14px] font-semibold text-white shadow-lg shadow-brand-500/25 hover:opacity-95 disabled:opacity-60"
      >
        {state === "busy" ? "Envoi…" : "Envoyer la demande"}
      </button>
    </form>
  );
}
