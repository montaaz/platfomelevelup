"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "@/styles/neu.module.css";

type Row = { id: string; name: string; size: number; kind: string; createdAt: string };

const ACCEPT = ".jpg,.jpeg,.png,.webp,.gif,.heic,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.txt,.csv,.zip";
const fmt = (n: number) => (n >= 1_048_576 ? `${(n / 1_048_576).toFixed(1)} Mo` : `${Math.max(1, Math.round(n / 1024))} Ko`);
const ICON: Record<string, string> = { image: "🖼️", pdf: "📄", document: "📝", archive: "🗜️", text: "📃" };

/**
 * Dépôt de fichiers sous un besoin (logo, photos, PDF, documents, archive).
 * Chaque fichier est contrôlé côté serveur ; un refus est expliqué ligne par ligne.
 */
export function NeedFiles({ need }: { need: string }) {
  const [files, setFiles] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [info, setInfo] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/fichiers?need=${encodeURIComponent(need)}`, { cache: "no-store" });
      if (res.ok) setFiles(((await res.json()) as { files: Row[] }).files);
    } catch {
      /* hors ligne : la liste restera vide */
    }
  }, [need]);

  useEffect(() => {
    void load();
  }, [load]);

  async function send(list: FileList | null) {
    if (!list || list.length === 0) return;
    setBusy(true);
    setErrors([]);
    setInfo(null);
    const form = new FormData();
    form.set("need", need);
    Array.from(list).slice(0, 10).forEach((f) => form.append("files", f));
    try {
      const res = await fetch("/api/fichiers", { method: "POST", body: form });
      const data = (await res.json()) as { saved?: Row[]; rejected?: { name: string; reason: string }[]; error?: string };
      if (!res.ok) {
        setErrors([data.error ?? "Dépôt impossible."]);
      } else {
        if (data.rejected?.length) setErrors(data.rejected.map((r) => `${r.name} : ${r.reason}`));
        if (data.saved?.length) setInfo(`${data.saved.length} fichier(s) ajouté(s) et vérifié(s).`);
        await load();
      }
    } catch {
      setErrors(["Connexion interrompue pendant l'envoi. Réessayez."]);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/fichiers/${id}`, { method: "DELETE" });
    if (res.ok) setFiles((cur) => cur.filter((f) => f.id !== id));
  }

  return (
    <div className={styles.filesBox}>
      <p className={styles.fieldLabel} style={{ marginTop: 0 }}>Vos fichiers (logo, photos, PDF, documents…)</p>
      <input ref={input} type="file" multiple accept={ACCEPT} onChange={(e) => void send(e.target.files)} disabled={busy} className={styles.srOnlyInput} id={`files-${need}`} />
      <label htmlFor={`files-${need}`} className={`${styles.tick} ${styles.tickRound}`} style={{ justifyContent: "center", cursor: busy ? "wait" : "pointer" }}>
        {busy ? "Vérification et envoi…" : "＋ Ajouter des fichiers"}
      </label>
      <p className={styles.callHint}>JPG, PNG, WebP, HEIC, PDF, Word, Excel, PowerPoint, texte ou ZIP — 25 Mo par fichier. Chaque fichier est contrôlé et analysé avant d&apos;être conservé.</p>
      {info && <p className={styles.fileOk}>{info}</p>}
      {errors.map((e) => (
        <p key={e} className={styles.fileErr}>✕ {e}</p>
      ))}
      {files.length > 0 && (
        <ul className={styles.fileList}>
          {files.map((f) => (
            <li key={f.id} className={styles.fileRow}>
              <a href={`/api/fichiers/${f.id}`} className={styles.fileName}>
                <span aria-hidden="true">{ICON[f.kind] ?? "📎"}</span> {f.name}
              </a>
              <span className={styles.fileMeta}>{fmt(f.size)}</span>
              <button type="button" onClick={() => void remove(f.id)} className={styles.fileDel} aria-label={`Supprimer ${f.name}`}>Supprimer</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
