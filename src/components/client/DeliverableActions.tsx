"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconCheck } from "@/components/icons";

async function gql(query: string, variables: Record<string, unknown>) {
  const res = await fetch("/api/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data;
}

export function DeliverableActions({ fileId, version }: { fileId: string; version: number }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "revision">("idle");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      await gql(`mutation($fileId: ID!) { approveDeliverable(fileId: $fileId) }`, { fileId });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    } finally {
      setBusy(false);
    }
  }

  async function sendRevision() {
    if (!comment.trim()) {
      setError("Expliquez ce qui doit changer.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await gql(`mutation($fileId: ID!, $comment: String!) { requestRevision(fileId: $fileId, comment: $comment) }`, {
        fileId,
        comment,
      });
      setMode("idle");
      setComment("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-ink/5 px-5 py-4 sm:px-6">
      <p className="text-[12.5px] text-slate-500">
        Vous avez reçu la version {version}. Approuvez-la pour lancer la livraison finale, ou demandez une révision en
        expliquant ce qui doit changer.
      </p>

      {mode === "revision" ? (
        <div className="mt-3 space-y-2.5">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="Ce qui doit changer…"
            className="w-full rounded-xl border border-ink/10 px-3.5 py-2.5 text-[13px] outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={sendRevision}
              disabled={busy}
              className="rounded-xl bg-violet-500 px-4 py-2.5 text-[13px] font-semibold text-white shadow-md shadow-violet-500/25 hover:bg-violet-600 disabled:opacity-60"
            >
              {busy ? "Envoi…" : "Envoyer la demande"}
            </button>
            <button
              onClick={() => setMode("idle")}
              disabled={busy}
              className="rounded-xl border border-ink/10 px-4 py-2.5 text-[13px] font-medium text-slate-600 hover:bg-slate-50"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2.5">
          <button
            onClick={() => setMode("revision")}
            disabled={busy}
            className="rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Demander une révision
          </button>
          <button
            onClick={approve}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2.5 text-[13px] font-semibold text-white shadow-md shadow-brand-500/25 hover:opacity-95 disabled:opacity-60"
          >
            <IconCheck width={15} height={15} />
            {busy ? "Validation…" : "Approuver le livrable"}
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-[12.5px] text-red-500">{error}</p>}
    </div>
  );
}
