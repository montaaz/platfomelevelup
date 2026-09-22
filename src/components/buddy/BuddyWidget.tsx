"use client";

import { useEffect, useRef, useState } from "react";
import { SUGGESTIONS } from "@/buddy/intents";

type Turn = {
  role: "user" | "bot";
  text: string;
  kind?: "answer" | "refusal" | "review";
  suggestions?: string[];
  actions?: { label: string; href: string }[];
};

/**
 * Bulle d'assistance de l'espace connecté.
 *
 * Elle n'affiche que ce que /api/buddy renvoie : des gabarits remplis avec
 * les données du compte, ou un refus. Un bot par règles ne comprend que les
 * questions apprises, d'où les puces : elles montrent ce qu'on peut demander
 * au lieu de laisser deviner.
 */
export function BuddyWidget({ role }: { role: "ADMIN" | "CLIENT" }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  // Contexte du dernier échange, renvoyé tel quel au serveur pour les
  // questions de suivi (« et les payées ? »). Le serveur le revalide.
  const [context, setContext] = useState<unknown>(undefined);
  const [loaded, setLoaded] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // À la première ouverture, le fil est repris là où il en était — contexte
  // de suivi compris, pour qu'un « et les payées ? » marche après rechargement.
  useEffect(() => {
    if (!open || loaded) return;
    setLoaded(true);
    fetch("/api/buddy")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || !Array.isArray(data.messages)) return;
        setTurns(
          data.messages.map((m: { role: "user" | "bot"; text: string; kind?: Turn["kind"]; actions?: Turn["actions"] }) => ({
            role: m.role, text: m.text, kind: m.kind ?? undefined, actions: m.actions ?? undefined,
          })),
        );
        if (data.context !== undefined) setContext(data.context);
      })
      .catch(() => { /* sans historique, on repart de zéro */ });
  }, [open, loaded]);

  async function clearHistory() {
    if (!window.confirm("Effacer votre conversation avec l'assistant ?")) return;
    try {
      await fetch("/api/buddy", { method: "DELETE" });
      setTurns([]);
      setContext(undefined);
    } catch { /* on garde l'affichage tel quel */ }
  }

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, pending]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || pending) return;
    setTurns((t) => [...t, { role: "user", text }]);
    setInput("");
    setPending(true);
    try {
      const res = await fetch("/api/buddy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, context }),
      });
      const data = await res.json();
      if (res.ok && data.context !== undefined) setContext(data.context);
      setTurns((t) => [
        ...t,
        res.ok && typeof data.text === "string"
          ? { role: "bot", text: data.text, kind: data.kind, suggestions: data.suggestions, actions: data.actions }
          : { role: "bot", text: data.error ?? "Une erreur est survenue. Réessayez.", kind: "refusal" },
      ]);
    } catch {
      setTurns((t) => [...t, { role: "bot", text: "Connexion impossible. Réessayez.", kind: "refusal" }]);
    } finally {
      setPending(false);
    }
  }

  const chips = (items: string[]) => (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.map((q) => (
        <button
          key={q}
          type="button"
          disabled={pending}
          onClick={() => void ask(q)}
          className="rounded-full border border-white/80 bg-white/70 px-2.5 py-1 text-[11.5px] font-medium text-ink/75 transition hover:border-brand-500/40 hover:text-brand-600 disabled:opacity-50"
        >
          {q}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Fermer l'assistant" : "Ouvrir l'assistant"}
        className="fixed right-4 bottom-20 z-40 flex h-13 w-13 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-lg transition hover:-translate-y-0.5 lg:right-6 lg:bottom-6 print:hidden"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.3-.7L3 21l1.9-5.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z" /></svg>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Assistant"
          className="glass-strong fixed right-4 bottom-36 z-40 flex max-h-[70vh] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-3xl shadow-2xl sm:w-96 lg:right-6 lg:bottom-24 print:hidden"
        >
          <header className="flex items-start justify-between gap-3 border-b border-ink/6 px-4 py-3">
            <div>
              <p className="text-[14px] font-semibold text-ink">Assistant</p>
              <p className="text-[11.5px] text-ink/60">Vos projets, commandes, factures et messages — d&apos;après vos données.</p>
            </div>
            {turns.length > 0 && (
              <button
                type="button"
                onClick={() => void clearHistory()}
                aria-label="Effacer la conversation"
                title="Effacer la conversation"
                className="shrink-0 rounded-lg p-1.5 text-ink/45 transition hover:bg-ink/5 hover:text-red-600"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" /></svg>
              </button>
            )}
          </header>

          <div ref={logRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            <div className="rounded-2xl rounded-tl-md bg-white/70 px-3 py-2 text-[13px] text-ink/85">
              Bonjour ! Posez-moi une question sur votre espace, ou choisissez ci-dessous.
              {turns.length === 0 && chips(SUGGESTIONS[role])}
            </div>
            {turns.map((turn, i) =>
              turn.role === "user" ? (
                <div key={i} className="ml-8 rounded-2xl rounded-tr-md bg-brand-500 px-3 py-2 text-[13px] text-white">{turn.text}</div>
              ) : (
                <div
                  key={i}
                  className={`whitespace-pre-line rounded-2xl rounded-tl-md px-3 py-2 text-[13px] text-ink/85 ${
                    turn.kind === "review" ? "border border-amber-200 bg-amber-50" : turn.kind === "refusal" ? "bg-ink/5" : "bg-white/70"
                  }`}
                >
                  {turn.text}
                  {turn.actions && turn.actions.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {turn.actions
                        .filter((a) => a.href.startsWith("/")) // jamais un lien externe
                        .map((a) => (
                          <a
                            key={a.href}
                            href={a.href}
                            className="rounded-full bg-brand-500 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-brand-600"
                          >
                            {a.label} →
                          </a>
                        ))}
                    </div>
                  )}
                  {turn.suggestions && turn.suggestions.length > 0 && chips(turn.suggestions)}
                </div>
              ),
            )}
            {pending && <div className="rounded-2xl rounded-tl-md bg-white/70 px-3 py-2 text-[13px] text-ink/50">Un instant…</div>}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); void ask(input); }}
            className="flex gap-2 border-t border-ink/6 p-3"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={1500}
              placeholder="Votre question…"
              aria-label="Votre question"
              className="min-w-0 flex-1 rounded-full border border-white/80 bg-white/70 px-3.5 py-2 text-[13px] text-ink outline-none focus:border-brand-500/50"
            />
            <button
              type="submit"
              disabled={pending || !input.trim()}
              aria-label="Envoyer"
              className="rounded-full bg-brand-500 px-3.5 text-white transition hover:bg-brand-600 disabled:opacity-50"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
