"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { gql } from "@/lib/gqlClient";
import { Modal, inputCls, labelCls, primaryBtnCls } from "@/components/Modal";
import { IconPlus } from "@/components/icons";

type ClientValues = {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  taxId: string;
  billingAddress: string;
  notes: string;
};

const EMPTY: ClientValues = {
  companyName: "", contactName: "", email: "", phone: "",
  address: "", city: "", taxId: "", billingAddress: "", notes: "",
};

export function ClientFormButton({
  editId,
  initial,
  label,
}: {
  editId?: string;
  initial?: Partial<ClientValues>;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<ClientValues>({ ...EMPTY, ...initial });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!editId;

  const set = (k: keyof ClientValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (isEdit) {
        await gql(`mutation($id: ID!, $input: ClientInput!) { updateClient(id: $id, input: $input) }`, {
          id: editId,
          input: values,
        });
      } else {
        await gql(`mutation($input: ClientInput!) { createClient(input: $input) { id } }`, { input: values });
      }
      setOpen(false);
      if (!isEdit) setValues(EMPTY);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {isEdit ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-[13px] font-medium text-brand-500 hover:text-brand-600"
        >
          {label ?? "Modifier"}
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={`${primaryBtnCls} inline-flex items-center gap-2`}>
          <IconPlus width={15} height={15} />
          {label ?? "Nouveau client"}
        </button>
      )}

      <Modal title={isEdit ? "Modifier le client" : "Nouveau client"} open={open} onClose={() => setOpen(false)} wide>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Entreprise *</label>
              <input required maxLength={160} value={values.companyName} onChange={set("companyName")} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Contact *</label>
              <input required maxLength={160} value={values.contactName} onChange={set("contactName")} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>E-mail</label>
              <input type="email" value={values.email} onChange={set("email")} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Téléphone</label>
              <input value={values.phone} onChange={set("phone")} className={inputCls} placeholder="+216 …" />
            </div>
            <div>
              <label className={labelCls}>Adresse</label>
              <input value={values.address} onChange={set("address")} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Ville</label>
              <input value={values.city} onChange={set("city")} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Matricule fiscal</label>
              <input value={values.taxId} onChange={set("taxId")} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Adresse de facturation</label>
              <input value={values.billingAddress} onChange={set("billingAddress")} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Notes internes</label>
            <textarea rows={2} value={values.notes} onChange={set("notes")} className={inputCls} />
          </div>

          {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[13px] text-red-600">{error}</p>}

          <button type="submit" disabled={busy} className={primaryBtnCls}>
            {busy ? "Enregistrement…" : isEdit ? "Enregistrer" : "Créer le client"}
          </button>
        </form>
      </Modal>
    </>
  );
}
