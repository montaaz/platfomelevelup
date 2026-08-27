"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { gql } from "@/lib/gqlClient";
import { Modal, inputCls, labelCls, primaryBtnCls } from "@/components/Modal";
import { IconPlus } from "@/components/icons";

export type Option = { id: string; name: string };

export function ProjectFormButton({
  clients,
  services,
  team,
}: {
  clients: Option[];
  services: Option[];
  team: Option[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState({
    clientId: "", serviceId: "", title: "", description: "",
    price: "", startDate: "", dueDate: "", assignedTeamMemberId: "",
  });

  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await gql(`mutation($input: ProjectInput!) { createProject(input: $input) { id } }`, {
        input: {
          clientId: values.clientId,
          serviceId: values.serviceId,
          title: values.title,
          description: values.description || null,
          price: parseFloat(values.price || "0"),
          startDate: values.startDate || null,
          dueDate: values.dueDate || null,
          assignedTeamMemberId: values.assignedTeamMemberId || null,
        },
      });
      setOpen(false);
      setValues({ clientId: "", serviceId: "", title: "", description: "", price: "", startDate: "", dueDate: "", assignedTeamMemberId: "" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`${primaryBtnCls} inline-flex items-center gap-2`}>
        <IconPlus width={15} height={15} />
        Nouveau projet
      </button>

      <Modal title="Nouveau projet" open={open} onClose={() => setOpen(false)} wide>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Client *</label>
              <select required value={values.clientId} onChange={set("clientId")} className={inputCls}>
                <option value="">Choisir…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Service *</label>
              <select required value={values.serviceId} onChange={set("serviceId")} className={inputCls}>
                <option value="">Choisir…</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Titre du projet *</label>
            <input required maxLength={200} value={values.title} onChange={set("title")} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea rows={2} value={values.description} onChange={set("description")} className={inputCls} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Prix (DT) *</label>
              <input required type="number" min="0" step="0.001" value={values.price} onChange={set("price")} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Assigné à</label>
              <select value={values.assignedTeamMemberId} onChange={set("assignedTeamMemberId")} className={inputCls}>
                <option value="">Personne</option>
                {team.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Date de début</label>
              <input type="date" value={values.startDate} onChange={set("startDate")} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Échéance</label>
              <input type="date" value={values.dueDate} onChange={set("dueDate")} className={inputCls} />
            </div>
          </div>

          {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[13px] text-red-600">{error}</p>}

          <button type="submit" disabled={busy} className={primaryBtnCls}>
            {busy ? "Création…" : "Créer le projet"}
          </button>
          <p className="text-[12px] text-ink/60">
            Le projet apparaît immédiatement dans l&apos;espace du client, avec ses étapes par défaut.
          </p>
        </form>
      </Modal>
    </>
  );
}
