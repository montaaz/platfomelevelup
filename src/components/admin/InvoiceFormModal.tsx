"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { gql } from "@/lib/gqlClient";
import { Modal, inputCls, labelCls, primaryBtnCls, secondaryBtnCls } from "@/components/Modal";
import { IconPlus } from "@/components/icons";
import type { Option } from "@/components/admin/ProjectFormModal";

type Line = { description: string; quantity: string; unitPrice: string };

export function InvoiceFormButton({
  clients,
  projects,
}: {
  clients: Option[];
  projects: { id: string; name: string; clientId: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [vatRate, setVatRate] = useState("19");
  const [lines, setLines] = useState<Line[]>([{ description: "", quantity: "1", unitPrice: "" }]);

  const setLine = (i: number, k: keyof Line, v: string) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));

  const subtotal = lines.reduce((s, l) => s + (parseFloat(l.quantity) || 0) * (parseFloat(l.unitPrice) || 0), 0);
  const vat = subtotal * ((parseFloat(vatRate) || 0) / 100);
  const clientProjects = projects.filter((p) => p.clientId === clientId);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await gql<{ createInvoice: { number: string } }>(
        `mutation($input: InvoiceInput!) { createInvoice(input: $input) { id number } }`,
        {
          input: {
            clientId,
            projectId: projectId || null,
            dueDate: dueDate || null,
            vatRate: parseFloat(vatRate),
            lines: lines.map((l) => ({
              description: l.description,
              quantity: parseFloat(l.quantity),
              unitPrice: parseFloat(l.unitPrice),
            })),
          },
        },
      );
      setOpen(false);
      setLines([{ description: "", quantity: "1", unitPrice: "" }]);
      setClientId("");
      setProjectId("");
      router.refresh();
      alert(`Facture ${data.createInvoice.number} créée.`);
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
        Nouvelle facture
      </button>

      <Modal title="Nouvelle facture" open={open} onClose={() => setOpen(false)} wide>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Client *</label>
              <select
                required
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  setProjectId("");
                }}
                className={inputCls}
              >
                <option value="">Choisir…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Projet lié</label>
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputCls} disabled={!clientId}>
                <option value="">Aucun</option>
                {clientProjects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Échéance de paiement</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>TVA (%)</label>
              <input type="number" min="0" max="100" step="0.01" value={vatRate} onChange={(e) => setVatRate(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Lignes de la facture *</label>
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    required
                    placeholder="Description"
                    value={line.description}
                    onChange={(e) => setLine(i, "description", e.target.value)}
                    className={`${inputCls} flex-1`}
                  />
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="Qté"
                    value={line.quantity}
                    onChange={(e) => setLine(i, "quantity", e.target.value)}
                    className={`${inputCls} w-20`}
                  />
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.001"
                    placeholder="Prix HT"
                    value={line.unitPrice}
                    onChange={(e) => setLine(i, "unitPrice", e.target.value)}
                    className={`${inputCls} w-28`}
                  />
                  {lines.length > 1 && (
                    <button
                      type="button"
                      aria-label="Supprimer la ligne"
                      onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                      className="rounded-xl px-2 text-ink/60 hover:bg-red-50 hover:text-red-500"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setLines((ls) => [...ls, { description: "", quantity: "1", unitPrice: "" }])}
              className={`${secondaryBtnCls} mt-2`}
            >
              + Ajouter une ligne
            </button>
          </div>

          <div className="rounded-xl bg-slate-50 px-4 py-3 text-[13px]">
            <div className="flex justify-between text-ink/72">
              <span>Sous-total HT</span>
              <span>{subtotal.toFixed(3)} DT</span>
            </div>
            <div className="flex justify-between text-ink/72">
              <span>TVA {vatRate || 0} %</span>
              <span>{vat.toFixed(3)} DT</span>
            </div>
            <div className="mt-1 flex justify-between border-t border-ink/10 pt-1 font-semibold text-ink">
              <span>Total TTC</span>
              <span>{(subtotal + vat).toFixed(3)} DT</span>
            </div>
          </div>

          {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[13px] text-red-600">{error}</p>}

          <button type="submit" disabled={busy} className={primaryBtnCls}>
            {busy ? "Création…" : "Créer la facture"}
          </button>
          <p className="text-[12px] text-ink/60">Le numéro est attribué automatiquement, en séquence, sans doublon.</p>
        </form>
      </Modal>
    </>
  );
}
