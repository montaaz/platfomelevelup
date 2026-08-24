"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { gql } from "@/lib/gqlClient";
import { Modal, inputCls, labelCls, primaryBtnCls, secondaryBtnCls } from "@/components/Modal";
import { Avatar } from "@/components/ui";
import { relativeTime } from "@/lib/format";

export type RequestData = {
  id: string;
  clientCompany: string;
  serviceName: string | null;
  title: string;
  description: string | null;
  byName: string;
  createdAt: string;
};

export function RequestsCard({ requests }: { requests: RequestData[] }) {
  const router = useRouter();
  const [accepting, setAccepting] = useState<RequestData | null>(null);
  const [price, setPrice] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (requests.length === 0) return null;

  async function accept() {
    if (!accepting) return;
    setBusy(true);
    setError(null);
    try {
      await gql(`mutation($requestId: ID!, $price: Float!, $dueDate: String) {
        acceptProjectRequest(requestId: $requestId, price: $price, dueDate: $dueDate) { projectId }
      }`, { requestId: accepting.id, price: parseFloat(price || "0"), dueDate: dueDate || null });
      setAccepting(null);
      setPrice("");
      setDueDate("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur.");
    } finally {
      setBusy(false);
    }
  }

  async function refuse(id: string) {
    if (!window.confirm("Refuser cette demande ?")) return;
    try {
      await gql(`mutation($requestId: ID!) { refuseProjectRequest(requestId: $requestId) }`, { requestId: id });
      router.refresh();
    } catch {
      /* surfaced by refresh */
    }
  }

  return (
    <section className="rounded-2xl border border-violet-200 bg-violet-50/50 shadow-card">
      <div className="px-5 pt-5 pb-2 sm:px-6">
        <h2 className="text-[15px] font-semibold text-ink">
          Demandes de projet
          <span className="ml-2 rounded-full bg-violet-500 px-2 py-0.5 text-[11px] font-bold text-white">{requests.length}</span>
        </h2>
        <p className="mt-0.5 text-[12.5px] text-slate-500">Envoyées par vos clients depuis leur espace</p>
      </div>
      <div className="divide-y divide-violet-100">
        {requests.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 sm:px-6">
            <Avatar name={r.clientCompany} size={36} />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold text-ink">
                {r.title}
                {r.serviceName && <span className="ml-2 text-[11.5px] font-medium text-violet-600">{r.serviceName}</span>}
              </p>
              <p className="truncate text-[12px] text-slate-500">
                {r.clientCompany} · {r.byName} · {relativeTime(r.createdAt)}
              </p>
              {r.description && <p className="mt-0.5 line-clamp-2 text-[12.5px] text-slate-500">{r.description}</p>}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setAccepting(r)} className={`${primaryBtnCls} !px-4 !py-2 text-[12.5px]`}>
                Accepter
              </button>
              <button type="button" onClick={() => refuse(r.id)} className={`${secondaryBtnCls} !px-4 !py-2 text-[12.5px]`}>
                Refuser
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal title={`Accepter — ${accepting?.title ?? ""}`} open={!!accepting} onClose={() => setAccepting(null)}>
        <div className="space-y-4">
          <p className="text-[13px] text-slate-500">
            Un projet sera créé pour <strong>{accepting?.clientCompany}</strong> et apparaîtra immédiatement dans son espace.
          </p>
          <div>
            <label className={labelCls}>Prix (DT) *</label>
            <input type="number" min="0" step="0.001" value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Échéance</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
          </div>
          {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[13px] text-red-600">{error}</p>}
          <button type="button" onClick={accept} disabled={busy || !price} className={primaryBtnCls}>
            {busy ? "Création…" : "Créer le projet"}
          </button>
        </div>
      </Modal>
    </section>
  );
}
