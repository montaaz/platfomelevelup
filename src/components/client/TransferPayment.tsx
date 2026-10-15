"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "@/styles/neu.module.css";

type Proof = { id: string; status: string; reviewNote: string | null; originalName: string | null; createdAt: string };

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

const GREEN = { background: "linear-gradient(135deg, #22c55e, #0a8f4e)", boxShadow: "6px 6px 14px rgba(10, 143, 78, .25), -4px -4px 12px #fff" } as const;

/**
 * Paiement par virement : le RIB à copier, le libellé à indiquer, puis le
 * bouton vert « J'ai fait le virement » (référence facultative, aucun
 * justificatif exigé). L'équipe vérifie le virement sur le compte et valide la
 * commande ; le client est averti dans son espace et par e-mail.
 */
export function TransferPayment({
  orderId,
  amount,
  label,
  bank,
  proof,
  /** "accueil" : dernière étape du questionnaire (avec le bouton « Entrer dans la plateforme »). */
  variant = "page",
}: {
  orderId: string;
  amount: string;
  label: string;
  bank: { holder: string; bank: string; rib: string; iban: string; bic: string };
  proof: Proof | null;
  variant?: "page" | "accueil";
}) {
  const router = useRouter();
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function declare(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("orderId", orderId);
    form.set("reference", reference);
    try {
      const res = await fetch("/api/paiement/virement", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Envoi impossible.");
      setSent(true);
      if (variant === "accueil") router.push("/client");
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
      <p style={{ fontSize: 13, fontWeight: 700, color: "#26303f" }}>Virement bancaire — {amount}</p>
      <p style={{ marginTop: 4, fontSize: 12.5, color: "#6b7689", fontWeight: 400, lineHeight: 1.5 }}>
        Virez <strong style={{ color: "#26303f" }}>{amount}</strong> sur le compte ci-dessous en indiquant le libellé{" "}
        <strong style={{ color: "#0a5ff0", userSelect: "all" }}>{label}</strong>, puis cliquez sur « J&apos;ai fait le virement ».
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
        <p role="status" style={{ marginTop: 14, padding: "10px 12px", borderRadius: 12, background: "#e6f7ee", color: "#0a6b3c", fontSize: 12.5, fontWeight: 600, lineHeight: 1.5 }}>
          ✓ Virement déclaré : l&apos;équipe vérifie la réception sur le compte et valide votre commande sous peu. Vous serez averti dans votre espace et par e-mail.
        </p>
      ) : (
        <form onSubmit={declare} style={{ marginTop: 14 }}>
          {proof?.status === "REFUSE" && (
            <p role="alert" style={{ marginBottom: 10, padding: "10px 12px", borderRadius: 12, background: "#fdecec", color: "#b42318", fontSize: 12.5, fontWeight: 600, lineHeight: 1.5 }}>
              Virement non retrouvé : {proof.reviewNote ?? "vérifiez le montant et le libellé, puis déclarez-le à nouveau."}
            </p>
          )}
          <label htmlFor={`ref-${orderId}`} style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#26303f" }}>
            Référence ou date du virement <span style={{ fontWeight: 500, color: "#8a93a6" }}>(facultatif)</span>
          </label>
          <input
            id={`ref-${orderId}`}
            className={styles.textarea}
            style={{ minHeight: 0, marginTop: 6 }}
            placeholder="Ex. : virement du 8 octobre, réf. 123456"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            maxLength={160}
          />
          {error && <p className={styles.error} role="alert" style={{ marginTop: 8 }}>{error}</p>}
          <button type="submit" className={styles.submit} disabled={busy} style={{ width: "100%", marginTop: 12, height: 50, ...GREEN }}>
            {busy ? "ENVOI…" : "✓ J'AI FAIT LE VIREMENT"}
          </button>
        </form>
      )}

      {variant === "accueil" && (
        <Link href="/client" className={styles.back} style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 10, height: 48, textDecoration: "none", width: "100%" }}>
          Entrer dans la plateforme
        </Link>
      )}
    </div>
  );
}
