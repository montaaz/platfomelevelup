"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { gql } from "@/lib/gqlClient";
import { inputCls, labelCls, primaryBtnCls, secondaryBtnCls } from "@/components/Modal";
import { PROJECT_STATUS_LABEL } from "@/lib/format";

const STATUSES = ["EN_ATTENTE", "EN_COURS", "EN_REVISION", "LIVRE", "CLOTURE"];

export function StatusChanger({ projectId, current }: { projectId: string; current: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    if (status === current) return;
    setBusy(true);
    setError(null);
    try {
      await gql(`mutation($projectId: ID!, $status: String!) { updateProjectStatus(projectId: $projectId, status: $status) }`, {
        projectId,
        status,
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <label className={labelCls}>Statut du projet</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{PROJECT_STATUS_LABEL[s]}</option>
          ))}
        </select>
      </div>
      <button type="button" onClick={apply} disabled={busy || status === current} className={primaryBtnCls}>
        {busy ? "…" : "Appliquer"}
      </button>
      {error && <p className="text-[12px] text-red-500">{error}</p>}
    </div>
  );
}

export function ReachStepButton({ projectId, position }: { projectId: string; position: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await gql(`mutation($projectId: ID!, $position: Int!) { reachProjectStep(projectId: $projectId, position: $position) }`, {
            projectId,
            position,
          });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
      className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-[11.5px] font-medium text-brand-600 hover:bg-brand-100 disabled:opacity-50"
    >
      {busy ? "…" : "Marquer franchie"}
    </button>
  );
}

export function UploadForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<"LIVRABLE" | "ELEMENT_CLIENT">("LIVRABLE");
  const [askValidation, setAskValidation] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("projectId", projectId);
      form.set("kind", kind);
      form.set("askValidation", kind === "LIVRABLE" && askValidation ? "1" : "0");
      const res = await fetch("/api/admin/upload", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur d'envoi.");
      setFile(null);
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 border-t border-ink/5 px-5 py-4 sm:px-6">
      <p className="text-[13px] font-semibold text-ink">Déposer un fichier</p>
      <input
        type="file"
        required
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="block w-full text-[13px] text-ink/72 file:mr-3 file:rounded-xl file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-[13px] file:font-medium file:text-brand-600 hover:file:bg-brand-100"
      />
      <div className="flex flex-wrap items-center gap-4">
        <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={`${inputCls} !w-auto`}>
          <option value="LIVRABLE">Livrable (visible client)</option>
          <option value="ELEMENT_CLIENT">Élément interne</option>
        </select>
        {kind === "LIVRABLE" && (
          <label className="flex items-center gap-2 text-[13px] text-ink/82">
            <input
              type="checkbox"
              checked={askValidation}
              onChange={(e) => setAskValidation(e.target.checked)}
              className="h-4 w-4 rounded accent-brand-500"
            />
            Demander la validation du client
          </label>
        )}
        <button type="submit" disabled={busy || !file} className={`${secondaryBtnCls} ml-auto`}>
          {busy ? "Envoi…" : "Envoyer"}
        </button>
      </div>
      {error && <p className="text-[12.5px] text-red-500">{error}</p>}
    </form>
  );
}
