"use client";

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
}: {
  projectId: string;
  projectTitle: string;
  backHref: string;
  messages: ThreadMessageData[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <section className="flex min-h-[60vh] flex-col glass rounded-2xl">
      <div className="flex items-center gap-3 border-b border-ink/5 px-5 py-4 sm:px-6">
        <Link href={backHref} className="text-[13px] font-medium text-brand-500 hover:text-brand-600">
          ← Retour
        </Link>
        <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">{projectTitle}</h2>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-400">Commencez la conversation.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex gap-3 ${m.mine ? "flex-row-reverse" : ""}`}>
            <Avatar name={m.senderName} size={32} />
            <div className={`max-w-[78%] ${m.mine ? "text-right" : ""}`}>
              <p className="text-[11.5px] text-slate-400">
                {m.senderName}
                {m.senderRole === "ADMIN" ? ", Level Up IA" : ""} · {formatDateShort(m.createdAt)}
              </p>
              <div
                className={`mt-1 inline-block rounded-2xl px-4 py-2.5 text-left text-[13.5px] leading-relaxed whitespace-pre-wrap ${
                  m.mine
                    ? "rounded-tr-md bg-gradient-to-r from-brand-500 to-violet-500 text-white"
                    : "rounded-tl-md bg-slate-100 text-ink"
                }`}
              >
                {m.body}
              </div>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={onSubmit} className="flex items-end gap-3 border-t border-ink/5 px-5 py-4 sm:px-6">
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
          className="min-h-11 flex-1 resize-none rounded-xl border border-white/80 bg-white/70 px-4 py-2.5 text-[13.5px] outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
        <button
          type="submit"
          disabled={busy || !body.trim()}
          className="rounded-xl bg-gradient-to-r from-brand-500 to-violet-500 px-5 py-3 text-[13.5px] font-semibold text-white shadow-md shadow-brand-500/25 hover:opacity-95 disabled:opacity-50"
        >
          {busy ? "Envoi…" : "Envoyer"}
        </button>
      </form>
      {error && <p className="px-6 pb-3 text-[12.5px] text-red-500">{error}</p>}
    </section>
  );
}
