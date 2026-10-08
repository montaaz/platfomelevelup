"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "@/styles/neu.module.css";

type Proof = { id: string; status: string; reviewNote: string | null; originalName: string; createdAt: string };

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value.replace(/\s+/g, ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* presse-papiers indisponible : la valeur reste sélectionnable */
    }
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #e6eaf2" }}>
      <div style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
        <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", color: "#8a93a6", textTransform: "uppercase" }}>{label}</p>
        <p style={{ fontSize: 13.5, fontWeight: 700, color: "#26303f", wordBreak: "break-all", userSelect: "all" }}>{value}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        style={{
          flexShrink: 0, border: 0, borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer",
          background: copied ? "#e6f7ee" : "#eef3ff", color: copied ? "#0a8f4e" : "#0a5ff0",
        }}
      >
        {copied ? "Copié ✓" : "Copier"}
      </button>
    </div>
  );
}

/**
 * Paiement par virement : coordonnées bancaires à copier, libellé à indiquer,
 * puis dépôt du justificatif. L'état du dernier justificatif (en vérification,
 * refusé avec motif) s'affiche à la place du formulaire quand il y a lieu.
 */
export function TransferPayment({
  orderId,
  amount,
  label,
  bank,
  proof,
}: {
  orderId: string;
  amount: string;
  label: string;
  bank: { holder: string; bank: string; rib: string; iban: string; bic: string };
  proof: Proof | null;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) return setError("Choisissez le fichier de votre justificatif.");
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("orderId", orderId);
    form.set("file", file);
    form.set("reference", reference);
    try {
      const res = await fetch("/api/paiement/virement", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Envoi impossible.");
      setSent(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Envoi impossible.");
    } finally {
      setBusy(false);
    }
  }

  const waiting = sent || proof?.status === "EN_ATTENTE";

  return (
    <div className={styles.choice} style={{ marginTop: 14, cursor: "default", display: "block", textAlign: "left" }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: "#26303f" }}>Virement bancaire</p>
      <p style={{ marginTop: 4, fontSize: 12.5, color: "#6b7689", fontWeight: 400, lineHeight: 1.5 }}>
        Virez <strong style={{ color: "#26303f" }}>{amount}</strong> sur le compte ci-dessous en indiquant le libellé{" "}
        <strong style={{ color: "#0a5ff0", userSelect: "all" }}>{label}</strong>, puis déposez votre justificatif.
        Votre commande est validée dès que l&apos;équipe constate le virement.
      </p>

      <div style={{ marginTop: 8 }}>
        <CopyRow label="Bénéficiaire" value={bank.holder} />
        <CopyRow label="Banque" value={bank.bank} />
        <CopyRow label="RIB" value={bank.rib} />
        <CopyRow label="IBAN" value={bank.iban} />
        <CopyRow label="Code BIC" value={bank.bic} />
        <CopyRow label="Libellé du virement" value={label} />
      </div>

      {waiting ? (
        <p role="status" style={{ marginTop: 14, padding: "10px 12px", borderRadius: 12, background: "#fff7e6", color: "#8a5a00", fontSize: 12.5, fontWeight: 600, lineHeight: 1.5 }}>
          ⏳ Justificatif reçu{proof?.originalName && !sent ? ` (${proof.originalName})` : ""} : l&apos;équipe vérifie le virement et
          valide votre commande sous peu. Vous serez averti dans votre espace et par e-mail.
        </p>
      ) : (
        <form onSubmit={onSubmit} style={{ marginTop: 14 }}>
          {proof?.status === "REFUSE" && (
            <p role="alert" style={{ marginBottom: 10, padding: "10px 12px", borderRadius: 12, background: "#fdecec", color: "#b42318", fontSize: 12.5, fontWeight: 600, lineHeight: 1.5 }}>
              Justificatif précédent refusé : {proof.reviewNote ?? "merci d'en déposer un nouveau."}
            </p>
          )}
          <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#26303f" }}>
            Justificatif de virement (PDF, JPG ou PNG, 10 Mo max.)
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              style={{ display: "block", marginTop: 6, width: "100%", fontSize: 12.5, fontWeight: 400 }}
            />
          </label>
          <label style={{ display: "block", marginTop: 10, fontSize: 12.5, fontWeight: 700, color: "#26303f" }}>
            Référence ou date du virement (facultatif)
            <input
              type="text"
              maxLength={160}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ex. : virement du 8 octobre, réf. 123456"
              style={{ display: "block", marginTop: 6, width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid #d9dfeb", fontSize: 13, fontWeight: 400 }}
            />
          </label>
          {error && <p role="alert" style={{ marginTop: 10, fontSize: 12.5, color: "#b42318", fontWeight: 600 }}>{error}</p>}
          <button type="submit" className={styles.submit} disabled={busy} style={{ width: "100%", marginTop: 14, height: 48 }}>
            {busy ? "Envoi…" : "Envoyer le justificatif"}
          </button>
        </form>
      )}
    </div>
  );
}
