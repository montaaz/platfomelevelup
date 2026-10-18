"use client";

import { DictationMic } from "@/components/DictationMic";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/ui";
import { formatDateShort } from "@/lib/format";

export type ThreadMessageData = {
  id: string;
  body: string;
  senderName: string;
  senderRole: string;
  mine: boolean;
  createdAt: string;
};

export function ThreadView({
  projectId,
  projectTitle,
  backHref,
  messages,
  suggest = false,
}: {
  projectId: string;
  projectTitle: string;
  backHref: string;
  messages: ThreadMessageData[];
  /** Admin : propose un brouillon rédigé par l'assistant à partir du dernier message du client. */
  suggest?: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function suggestReply() {
    setSuggesting(true);
    setError(null);
    try {
      const res = await fetch("/api/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `query($projectId: ID!) { suggestReply(projectId: $projectId) { text enabled } }`,
          variables: { projectId },
        }),
      });
      const json = await res.json();
      if (json.errors?.length) throw new Error(json.errors[0].message);
      const { text, enabled } = json.data.suggestReply as { text: string | null; enabled: boolean };
      if (!enabled) setError("Assistant désactivé (MESSAGING_AI).");
      else if (!text) setError("L'assistant n'a pas de réponse sûre pour ce message : rédigez-la vous-même.");
      else setBody(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Suggestion indisponible.");
    } finally {
      setSuggesting(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `mutation($projectId: ID!, $body: String!) { sendMessage(projectId: $projectId, body: $body) { id } }`,
          variables: { projectId, body },
        }),
      });
      const json = await res.json();
      if (json.errors?.length) throw new Error(json.errors[0].message);
      setBody("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur d'envoi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section data-tilt className="flex min-h-[60vh] flex-col glass relative rounded-2xl">
      <div className="flex items-center gap-3 border-b border-ink/5 px-5 py-4 sm:px-6">
        <Link href={backHref} className="text-[13px] font-medium text-brand-500 hover:text-brand-600">
          ← Retour
        </Link>
        <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">{projectTitle}</h2>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-ink/60">Commencez la conversation.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex gap-3 ${m.mine ? "flex-row-reverse" : ""}`}>
            <Avatar name={m.senderName} size={32} />
            <div className={`max-w-[78%] ${m.mine ? "text-right" : ""}`}>
              <p className="text-[11.5px] text-ink/60">
                {m.senderName}
                {m.senderRole === "ADMIN" && m.senderName !== "LevelUpAI Assistant" ? ", Level Up AI" : ""} · {formatDateShort(m.createdAt)}
              </p>
              <div
                className={`mt-1 inline-block rounded-2xl px-4 py-2.5 text-left text-[13.5px] leading-relaxed whitespace-pre-wrap ${
                  m.mine
                    ? "rounded-tr-md btn-3d bg-gradient-to-r from-brand-500 to-violet-500 text-white"
                    : "rounded-tl-md bg-slate-100 text-ink"
                }`}
              >
                {m.body}
              </div>
            </div>
          </div>
        ))}
      </div>

      {suggest && (
        <div className="flex justify-end border-t border-ink/5 px-5 pt-3 sm:px-6">
          <button
            type="button"
            onClick={suggestReply}
            disabled={suggesting || busy}
            className="rounded-full bg-violet-50 px-3 py-1.5 text-[12.5px] font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-60"
          >
            {suggesting ? "L'assistant rédige…" : "✨ Suggérer une réponse"}
          </button>
        </div>
      )}
      <form onSubmit={onSubmit} className={`flex items-end gap-3 px-5 py-4 sm:px-6 ${suggest ? "" : "border-t border-ink/5"}`}>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          rows={2}
          placeholder="Écrire un message…"
          className="min-h-11 flex-1 resize-none rounded-xl border border-white/70 bg-white/55 backdrop-blur-md px-4 py-2.5 text-[13.5px] outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
        <DictationMic value={body} onChange={setBody} context="Message à l'équipe" size={40} />
        <button
          type="submit"
          disabled={busy || !body.trim()}
          className="rounded-xl btn-3d bg-gradient-to-r from-brand-500 to-violet-500 px-5 py-3 text-[13.5px] font-semibold text-white shadow-md shadow-brand-500/25 hover:opacity-95 disabled:opacity-50"
        >
          {busy ? "Envoi…" : "Envoyer"}
        </button>
      </form>
      {error && <p className="px-6 pb-3 text-[12.5px] text-red-500">{error}</p>}
    </section>
  );
}
