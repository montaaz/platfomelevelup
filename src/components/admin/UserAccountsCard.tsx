"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { gql } from "@/lib/gqlClient";
import { Modal, inputCls, labelCls, primaryBtnCls, secondaryBtnCls } from "@/components/Modal";
import { Avatar, StatusBadge } from "@/components/ui";
import { IconPlus } from "@/components/icons";
import { formatDateFull } from "@/lib/format";

export type UserAccountData = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  clientCompany: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  isSelf: boolean;
};

export function UserAccountsCard({
  accounts,
  clients,
}: {
  accounts: UserAccountData[];
  clients: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [resetFor, setResetFor] = useState<UserAccountData | null>(null);
  const [values, setValues] = useState({ role: "ADMIN", fullName: "", email: "", password: "", clientId: "" });
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await gql(`mutation($input: UserAccountInput!) { createUserAccount(input: $input) { id } }`, {
        input: {
          role: values.role,
          fullName: values.fullName,
          email: values.email,
          password: values.password,
          clientId: values.role === "CLIENT" ? values.clientId || null : null,
        },
      });
      setCreateOpen(false);
      setValues({ role: "ADMIN", fullName: "", email: "", password: "", clientId: "" });
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
      setResetFor(null);
      setNewPassword("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(account: UserAccountData) {
    if (!window.confirm(account.isActive ? `Désactiver le compte de ${account.fullName} ?` : `Réactiver le compte de ${account.fullName} ?`)) return;
    try {
      await gql(`mutation($userId: ID!, $active: Boolean!) { setUserActive(userId: $userId, active: $active) }`, {
        userId: account.id,
        active: !account.isActive,
      });
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur.");
    }
  }

  return (
    <section data-tilt className="glass relative rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 pb-3 sm:px-6 sm:pt-5">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Comptes de connexion</h2>
          <p className="mt-0.5 text-[12.5px] text-ink/72">Enregistrés en base de données — créez, réinitialisez, désactivez</p>
        </div>
        <button type="button" onClick={() => setCreateOpen(true)} className={`${primaryBtnCls} inline-flex items-center gap-2 !px-4 !py-2 text-[12.5px]`}>
          <IconPlus width={14} height={14} />
          Nouveau compte
        </button>
      </div>

      <div className="divide-y divide-ink/4 pb-2">
        {accounts.map((account) => (
          <div key={account.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
            <Avatar name={account.fullName} size={36} />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold text-ink">
                {account.fullName}
                {account.isSelf && <span className="ml-2 text-[11px] font-medium text-brand-500">(vous)</span>}
              </p>
              <p className="truncate text-[12px] text-ink/60">
                {account.email}
                {account.clientCompany ? ` · ${account.clientCompany}` : ""}
                {account.lastLoginAt ? ` · vu le ${formatDateFull(account.lastLoginAt)}` : " · jamais connecté"}
              </p>
            </div>
            <StatusBadge
              status={account.role === "ADMIN" ? "EN_REVISION" : "EN_COURS"}
              label={account.role === "ADMIN" ? "Admin" : "Client"}
            />
            {!account.isActive && <StatusBadge status="EN_RETARD" label="Désactivé" />}
            <div className="flex gap-2">
              <button type="button" onClick={() => setResetFor(account)} className={`${secondaryBtnCls} !px-3 !py-1.5 text-[12px]`}>
                Mot de passe
              </button>
              {!account.isSelf && (
                <button
                  type="button"
                  onClick={() => toggleActive(account)}
                  className={`${secondaryBtnCls} !px-3 !py-1.5 text-[12px] ${account.isActive ? "hover:text-red-600" : "hover:text-emerald-600"}`}
                >
                  {account.isActive ? "Désactiver" : "Réactiver"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* create */}
      <Modal title="Nouveau compte de connexion" open={createOpen} onClose={() => { setCreateOpen(false); setError(null); }}>
        <form onSubmit={onCreate} className="space-y-4">
          <div>
            <label className={labelCls}>Rôle *</label>
            <select value={values.role} onChange={set("role")} className={inputCls}>
              <option value="ADMIN">Admin — accès total</option>
              <option value="CLIENT">Client — son espace uniquement</option>
            </select>
          </div>
          {values.role === "CLIENT" && (
            <div>
              <label className={labelCls}>Client rattaché *</label>
              <select required value={values.clientId} onChange={set("clientId")} className={inputCls}>
                <option value="">Choisir…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className={labelCls}>Nom complet *</label>
            <input required maxLength={160} value={values.fullName} onChange={set("fullName")} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Adresse e-mail *</label>
            <input type="email" required value={values.email} onChange={set("email")} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Mot de passe initial * <span className="font-normal text-ink/55">(8 caractères minimum)</span></label>
            <input type="password" required minLength={8} value={values.password} onChange={set("password")} className={inputCls} autoComplete="new-password" />
          </div>
          {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[13px] text-red-600">{error}</p>}
          <button type="submit" disabled={busy} className={primaryBtnCls}>
            {busy ? "Création…" : "Créer le compte"}
          </button>
        </form>
      </Modal>

      {/* reset password */}
      <Modal title={`Nouveau mot de passe — ${resetFor?.fullName ?? ""}`} open={!!resetFor} onClose={() => { setResetFor(null); setError(null); }}>
        <form onSubmit={onReset} className="space-y-4">
          <p className="text-[13px] text-ink/72">
            Définissez un nouveau mot de passe pour <strong>{resetFor?.email}</strong>. La personne pourra ensuite le changer elle-même.
          </p>
          <div>
            <label className={labelCls}>Nouveau mot de passe * <span className="font-normal text-ink/55">(8 caractères minimum)</span></label>
            <input type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputCls} autoComplete="new-password" />
          </div>
          {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[13px] text-red-600">{error}</p>}
          <button type="submit" disabled={busy} className={primaryBtnCls}>
            {busy ? "Enregistrement…" : "Réinitialiser"}
          </button>
        </form>
      </Modal>
    </section>
  );
}
