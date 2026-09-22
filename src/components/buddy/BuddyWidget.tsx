"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { L } from "@/buddy/locales";
import type { Lang } from "@/buddy/core/language";

type Turn = {
  role: "user" | "bot";
  text: string;
  kind?: "answer" | "refusal" | "review" | "error";
  suggestions?: string[];
  actions?: { label: string; href: string }[];
  /** Question à renvoyer si l'utilisateur clique sur « Réessayer ». */
  retryFor?: string;
};

/**
 * Bulle d'assistance de l'espace connecté.
 *
 * Elle n'affiche que ce que /api/buddy renvoie : des gabarits remplis avec
 * les données du compte, ou un refus. Les libellés viennent du dictionnaire
 * de l'assistant, dans la langue de la dernière réponse. Le fil est repris
 * à l'ouverture, contexte de suivi compris.
 */
export function BuddyWidget({ role }: { role: "ADMIN" | "CLIENT" }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [lang, setLang] = useState<Lang>("fr");
  const [context, setContext] = useState<unknown>(undefined);
  const [loaded, setLoaded] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const t = L(lang);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, pending]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // À la première ouverture, le fil est repris là où il en était.
  useEffect(() => {
    if (!open || loaded) return;
    setLoaded(true);
    fetch("/api/buddy")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || !Array.isArray(data.messages)) return;
        setTurns(data.messages.map((m: Turn) => ({ role: m.role, text: m.text, kind: m.kind ?? undefined, actions: m.actions ?? undefined })));
        if (data.context !== undefined) setContext(data.context);
        if (data.context?.lang === "en" || data.context?.lang === "fr") setLang(data.context.lang);
      })
      .catch(() => { /* sans historique, on repart de zéro */ });
  }, [open, loaded]);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || pending) return;
    setTurns((prev) => [...prev, { role: "user", text }]);
    setInput("");
    setPending(true);
    try {
      const res = await fetch("/api/buddy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, context }),
      });
      const data = await res.json();
      if (res.ok && typeof data.text === "string") {
        if (data.context !== undefined) setContext(data.context);
        if (data.lang === "en" || data.lang === "fr") setLang(data.lang);
        setTurns((prev) => [...prev, { role: "bot", text: data.text, kind: data.kind, suggestions: data.suggestions, actions: data.actions }]);
      } else {
        setTurns((prev) => [...prev, { role: "bot", text: data.error ?? t.widget.error, kind: "error", retryFor: text }]);
      }
    } catch {
      setTurns((prev) => [...prev, { role: "bot", text: t.widget.error, kind: "error", retryFor: text }]);
    } finally {
      setPending(false);
    }
  }

  async function clearHistory() {
    if (!window.confirm(t.widget.confirmClear)) return;
    try {
      await fetch("/api/buddy", { method: "DELETE" });
      setTurns([]);
      setContext(undefined);
    } catch { /* on garde l'affichage tel quel */ }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Entrée envoie ; Maj+Entrée insère un saut de ligne.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void ask(input);
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
          className="rounded-full border border-white/80 bg-white/70 px-2.5 py-1 text-left text-[11.5px] font-medium text-ink/75 transition hover:border-brand-500/40 hover:text-brand-600 disabled:opacity-50"
        >
          {q}
        </button>
      ))}
    </div>
  );

  const lastBot = [...turns].reverse().find((x) => x.role === "bot");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? t.widget.close : t.widget.open}
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
          aria-label={t.widget.title}
          className="glass-strong fixed inset-x-3 bottom-36 z-40 flex max-h-[min(70vh,34rem)] flex-col overflow-hidden rounded-3xl shadow-2xl sm:inset-x-auto sm:right-4 sm:w-96 lg:right-6 lg:bottom-24 print:hidden"
        >
          <header className="flex items-start justify-between gap-3 border-b border-ink/6 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-ink">{t.widget.title}</p>
              <p className="text-[11.5px] text-ink/60">{t.widget.subtitle}</p>
            </div>
            {turns.length > 0 && (
              <button
                type="button"
                onClick={() => void clearHistory()}
                aria-label={t.widget.clear}
                title={t.widget.clear}
                className="shrink-0 rounded-lg p-1.5 text-ink/45 transition hover:bg-ink/5 hover:text-red-600"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" /></svg>
              </button>
            )}
          </header>

          <div ref={logRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {turns.length === 0 && (
              <div className="rounded-2xl rounded-tl-md bg-white/70 px-3 py-2 text-[13px] text-ink/85">
                {t.widget.intro}
                {chips(t.suggestions(role))}
              </div>
            )}
            {turns.map((turn, i) =>
              turn.role === "user" ? (
                <div key={i} className="ml-8 break-words whitespace-pre-line rounded-2xl rounded-tr-md bg-brand-500 px-3 py-2 text-[13px] text-white">{turn.text}</div>
              ) : (
                <div
                  key={i}
                  className={`mr-4 break-words whitespace-pre-line rounded-2xl rounded-tl-md px-3 py-2 text-[13px] text-ink/85 ${
                    turn.kind === "review" ? "border border-amber-200 bg-amber-50"
                      : turn.kind === "error" ? "border border-red-200 bg-red-50"
                      : turn.kind === "refusal" ? "bg-ink/5" : "bg-white/70"
                  }`}
                >
                  {turn.text}
                  {turn.actions && turn.actions.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {turn.actions.filter((a) => a.href.startsWith("/")).map((a) => (
                        <a key={a.href + a.label} href={a.href} className="rounded-full bg-brand-500 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-brand-600">
                          {a.label} →
                        </a>
                      ))}
                    </div>
                  )}
                  {turn.kind === "error" && turn.retryFor && turn === lastBot && (
                    <div className="mt-2">
                      <button type="button" disabled={pending} onClick={() => void ask(turn.retryFor!)} className="rounded-full border border-red-300 bg-white px-3 py-1 text-[12px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
                        {t.widget.retry}
                      </button>
                    </div>
                  )}
                  {turn.suggestions && turn.suggestions.length > 0 && turn === lastBot && chips(turn.suggestions)}
                </div>
              ),
            )}
            {pending && (
              <div className="flex items-center gap-2 rounded-2xl rounded-tl-md bg-white/70 px-3 py-2 text-[13px] text-ink/50" aria-live="polite">
                <span className="inline-flex gap-0.5"><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink/40" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink/40 [animation-delay:120ms]" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink/40 [animation-delay:240ms]" /></span>
                {t.widget.loading}
              </div>
            )}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); void ask(input); }} className="flex items-end gap-2 border-t border-ink/6 p-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              maxLength={1500}
              placeholder={t.widget.placeholder}
              aria-label={t.widget.placeholder}
              className="max-h-28 min-w-0 flex-1 resize-none rounded-2xl border border-white/80 bg-white/70 px-3.5 py-2 text-[13px] text-ink outline-none focus:border-brand-500/50"
            />
            <button type="submit" disabled={pending || !input.trim()} aria-label={t.widget.send} className="rounded-full bg-brand-500 p-2.5 text-white transition hover:bg-brand-600 disabled:opacity-50">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
