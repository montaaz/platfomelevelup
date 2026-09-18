"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { gql } from "@/lib/gqlClient";
import { Modal, inputCls, labelCls, primaryBtnCls, secondaryBtnCls } from "@/components/Modal";
import { Card, CardHeader, StatusBadge } from "@/components/ui";
import { formatDateFull } from "@/lib/format";

export type ClientAccount = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  authProvider: string;
  /** Verrouillage temporaire après échecs répétés (null si aucun en cours). */
  lockedUntil: string | null;
};

/** Mot de passe lisible, à transmettre au client, sans caractères ambigus. */
function suggestPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(14));
  return [...bytes].map((n) => alphabet[n % alphabet.length]).join("");
}

/**
 * Accès du client, sur sa fiche : créer une connexion, changer le mot de
 * passe, bloquer ou rétablir l'entrée.
 *
 * Le rattachement au client n'est jamais choisi ici : il vient de la fiche
 * ouverte, ce qui évite de créer par mégarde un accès chez quelqu'un d'autre.
 */
export function ClientLoginCard({
  clientId,
  contactName,
  clientEmail,
  accounts,
}: {
  clientId: string;
  contactName: string;
  clientEmail: string | null;
  accounts: ClientAccount[];
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [resetFor, setResetFor] = useState<ClientAccount | null>(null);
  const [form, setForm] = useState({ fullName: "", email: "", password: "" });
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function openCreate() {
    setForm({ fullName: contactName, email: clientEmail ?? "", password: suggestPassword() });
    setError(null);
    setDone(null);
    setCreateOpen(true);
  }

  function openReset(account: ClientAccount) {
    setNewPassword(suggestPassword());
    setError(null);
    setDone(null);
    setResetFor(account);
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await gql(
        `mutation($clientId: ID!, $fullName: String!, $email: String!, $password: String!) {
           createClientLogin(clientId: $clientId, fullName: $fullName, email: $email, password: $password) { id }
         }`,
        { clientId, ...form },
      );
      setCreateOpen(false);
      setDone(`Accès créé pour ${form.email} — mot de passe : ${form.password}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setBusy(false);
    }
  }

  async function onReset(e: FormEvent) {
    e.preventDefault();
    if (!resetFor) return;
    setBusy(true);
    setError(null);
    try {
      await gql(`mutation($userId: ID!, $newPassword: String!) { resetUserPassword(userId: $userId, newPassword: $newPassword) }`, {
        userId: resetFor.id,
        newPassword,
      });
      const email = resetFor.email;
      setResetFor(null);
      setDone(`Nouveau mot de passe de ${email} : ${newPassword}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(account: ClientAccount) {
    const question = account.isActive
      ? `Bloquer l'accès de ${account.email} ? Le client ne pourra plus se connecter.`
      : `Rétablir l'accès de ${account.email} ?`;
    if (!window.confirm(question)) return;
    setDone(null);
    try {
      await gql(`mutation($userId: ID!, $active: Boolean!) { setUserActive(userId: $userId, active: $active) }`, {
        userId: account.id,
        active: !account.isActive,
      });
      setDone(account.isActive ? "Accès bloqué." : "Accès rétabli.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    }
  }

  return (
    <Card>
      <CardHeader
        title="Accès du client"
        subtitle="Connexion à l'espace client — mot de passe et blocage"
      />

      {done && (
        <div className="mx-4 mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 sm:mx-6">
          <p className="text-[12.5px] font-medium break-all text-emerald-700">{done}</p>
          <p className="mt-1 text-[11px] text-emerald-600/80">
            Notez-le maintenant : il ne sera plus affiché.
          </p>
        </div>
      )}
      {error && !createOpen && !resetFor && (
        <p className="mx-4 mb-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-[12.5px] text-red-600 sm:mx-6">{error}</p>
      )}

      <div className="divide-y divide-ink/4">
        {accounts.map((account) => (
          <div key={account.id} className="px-4 py-3.5 sm:px-6">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
              <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{account.email}</p>
              {account.isActive ? (
                <StatusBadge status="EN_COURS" label="Actif" />
              ) : (
                <StatusBadge status="EN_RETARD" label="Bloqué" />
              )}
            </div>
            <p className="mt-1 text-[11.5px] text-ink/60">
              {account.fullName}
              {" · "}
              {account.lastLoginAt ? `vu le ${formatDateFull(account.lastLoginAt)}` : "jamais connecté"}
              {account.authProvider === "GOOGLE" && " · connexion Google"}
            </p>
            {account.lockedUntil && (
              <p className="mt-1 text-[11.5px] font-medium text-amber-600">
                Verrouillé après trop d&apos;essais — le mot de passe réinitialisé lève ce blocage.
              </p>
            )}

            <div className="mt-2.5 flex flex-wrap gap-2">
              {account.authProvider === "GOOGLE" ? (
                <span className="text-[11.5px] text-ink/50">
                  Compte Google : le mot de passe est géré par Google.
                </span>
              ) : (
                <button type="button" onClick={() => openReset(account)} className={`${secondaryBtnCls} !px-3 !py-1.5 text-[12px]`}>
                  Changer le mot de passe
                </button>
              )}
              <button
                type="button"
                onClick={() => toggleActive(account)}
                className={`${secondaryBtnCls} !px-3 !py-1.5 text-[12px] ${
                  account.isActive ? "hover:text-red-600" : "hover:text-emerald-600"
                }`}
              >
                {account.isActive ? "Bloquer l'accès" : "Rétablir l'accès"}
              </button>
            </div>
          </div>
        ))}

        {accounts.length === 0 && (
          <div className="px-4 py-5 text-center sm:px-6">
            <p className="text-[13px] text-ink/70">Ce client n&apos;a pas encore d&apos;accès.</p>
            <p className="mt-1 text-[11.5px] text-ink/55">
              Créez-en un pour qu&apos;il puisse consulter ses projets et ses factures.
            </p>
          </div>
        )}
      </div>

      <div className="px-4 pt-1 pb-4 sm:px-6">
        <button type="button" onClick={openCreate} className={`${primaryBtnCls} w-full !py-2 text-[12.5px]`}>
          {accounts.length === 0 ? "Créer un accès" : "Ajouter un autre accès"}
        </button>
      </div>

      {/* création */}
      <Modal title="Créer un accès client" open={createOpen} onClose={() => { setCreateOpen(false); setError(null); }}>
        <form onSubmit={onCreate} className="space-y-4">
          <div>
            <label className={labelCls}>Nom complet *</label>
            <input
              required
              maxLength={160}
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Adresse e-mail *</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className={inputCls}
            />
            <p className="mt-1 text-[11.5px] text-ink/55">C&apos;est avec cette adresse que le client se connectera.</p>
          </div>
          <div>
            <label className={labelCls}>Mot de passe * (8 caractères minimum)</label>
            <div className="flex gap-2">
              <input
                required
                minLength={8}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className={inputCls}
              />
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, password: suggestPassword() }))}
                className={`${secondaryBtnCls} shrink-0 !px-3 text-[12px]`}
              >
                Générer
              </button>
            </div>
            <p className="mt-1 text-[11.5px] text-ink/55">À transmettre au client ; il pourra le modifier ensuite.</p>
          </div>
          {error && <p className="text-[12.5px] text-red-600">{error}</p>}
          <div className="flex justify-end gap-2.5">
            <button type="button" onClick={() => setCreateOpen(false)} className={secondaryBtnCls}>Annuler</button>
            <button type="submit" disabled={busy} className={primaryBtnCls}>{busy ? "Création…" : "Créer l'accès"}</button>
          </div>
        </form>
      </Modal>

      {/* changement de mot de passe */}
      <Modal
        title={`Mot de passe — ${resetFor?.email ?? ""}`}
        open={resetFor !== null}
        onClose={() => { setResetFor(null); setError(null); }}
      >
        <form onSubmit={onReset} className="space-y-4">
          <div>
            <label className={labelCls}>Nouveau mot de passe * (8 caractères minimum)</label>
            <div className="flex gap-2">
              <input
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputCls}
              />
              <button
                type="button"
                onClick={() => setNewPassword(suggestPassword())}
                className={`${secondaryBtnCls} shrink-0 !px-3 text-[12px]`}
              >
                Générer
              </button>
            </div>
            <p className="mt-1 text-[11.5px] text-ink/55">
              L&apos;ancien mot de passe cesse aussitôt de fonctionner. Tout verrouillage en cours est levé.
            </p>
          </div>
          {error && <p className="text-[12.5px] text-red-600">{error}</p>}
          <div className="flex justify-end gap-2.5">
            <button type="button" onClick={() => setResetFor(null)} className={secondaryBtnCls}>Annuler</button>
            <button type="submit" disabled={busy} className={primaryBtnCls}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
