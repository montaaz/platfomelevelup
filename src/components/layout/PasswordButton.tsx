"use client";

import { useState, type FormEvent } from "react";
import { gql } from "@/lib/gqlClient";
import { Modal, inputCls, labelCls, primaryBtnCls } from "@/components/Modal";

export function PasswordButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function close() {
    setOpen(false);
    setCurrent(""); setNext(""); setConfirm("");
    setError(null); setDone(false);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (next.length < 8) { setError("Le nouveau mot de passe doit contenir au moins 8 caractères."); return; }
    if (next !== confirm) { setError("La confirmation ne correspond pas."); return; }
    setBusy(true);
    try {
      await gql(`mutation($current: String!, $next: String!) { changeMyPassword(current: $current, next: $next) }`, {
        current, next,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className ?? "btn-glass flex w-full items-center justify-center gap-2 rounded-xl border border-white/80 bg-white/60 py-2 text-[12.5px] font-semibold text-ink/80 hover:text-brand-600"}
      >
        🔑 Mot de passe
      </button>

      <Modal title="Changer le mot de passe" open={open} onClose={close}>
        {done ? (
          <div className="space-y-4 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-2xl">✓</span>
            <p className="text-[14px] font-semibold text-ink">Mot de passe modifié</p>
            <p className="text-[13px] text-ink/72">Utilisez votre nouveau mot de passe lors de votre prochaine connexion.</p>
            <button type="button" onClick={close} className={primaryBtnCls}>Fermer</button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className={labelCls}>Mot de passe actuel *</label>
              <input type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Nouveau mot de passe * <span className="font-normal text-ink/55">(8 caractères minimum)</span></label>
              <input type="password" required minLength={8} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Confirmer le nouveau mot de passe *</label>
              <input type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} />
            </div>
            {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[13px] text-red-600">{error}</p>}
            <button type="submit" disabled={busy} className={primaryBtnCls}>
              {busy ? "Modification…" : "Changer le mot de passe"}
            </button>
          </form>
        )}
      </Modal>
    </>
  );
}
