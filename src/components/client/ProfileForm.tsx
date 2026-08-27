"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Profile = {
  fullName: string;
  email: string;
  companyName: string;
  contactName: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  taxId: string | null;
  billingAddress: string | null;
};

function Field({
  label, id, value, onChange, disabled = false, placeholder,
}: {
  label: string;
  id: string;
  value: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full rounded-xl border border-white/80 bg-white/70 px-4 py-3 text-[14px] outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-400"
      />
    </div>
  );
}

export function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(profile.fullName);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [address, setAddress] = useState(profile.address ?? "");
  const [city, setCity] = useState(profile.city ?? "");
  const [taxId, setTaxId] = useState(profile.taxId ?? "");
  const [billingAddress, setBillingAddress] = useState(profile.billingAddress ?? "");
  const [state, setState] = useState<"idle" | "busy" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setState("busy");
    setError(null);
    try {
      const res = await fetch("/api/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `mutation($input: ProfileInput!) { updateMyProfile(input: $input) }`,
          variables: { input: { fullName, phone, address, city, taxId, billingAddress } },
        }),
      });
      const json = await res.json();
      if (json.errors?.length) throw new Error(json.errors[0].message);
      setState("saved");
      router.refresh();
      setTimeout(() => setState("idle"), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur d'enregistrement.");
      setState("idle");
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-6">
      <section className="space-y-4 glass rounded-2xl p-6 sm:p-7">
        <h3 className="text-[14.5px] font-semibold text-ink">Coordonnées</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nom complet" id="fullName" value={fullName} onChange={setFullName} />
          <Field label="Adresse e-mail" id="email" value={profile.email} disabled />
          <Field label="Téléphone" id="phone" value={phone} onChange={setPhone} placeholder="+216 …" />
          <Field label="Entreprise" id="company" value={profile.companyName} disabled />
        </div>
      </section>

      <section className="space-y-4 glass rounded-2xl p-6 sm:p-7">
        <h3 className="text-[14.5px] font-semibold text-ink">Informations de facturation</h3>
        <p className="-mt-2 text-[12.5px] text-slate-400">Ces informations seront reprises sur vos prochaines factures.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Adresse" id="address" value={address} onChange={setAddress} />
          <Field label="Ville" id="city" value={city} onChange={setCity} />
          <Field label="Matricule fiscal" id="taxId" value={taxId} onChange={setTaxId} />
          <Field label="Adresse de facturation (si différente)" id="billing" value={billingAddress} onChange={setBillingAddress} />
        </div>
      </section>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-600">{error}</p>}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={state === "busy"}
          className="rounded-xl bg-gradient-to-r from-brand-500 to-violet-500 px-6 py-3 text-[14px] font-semibold text-white shadow-lg shadow-brand-500/25 hover:opacity-95 disabled:opacity-60"
        >
          {state === "busy" ? "Enregistrement…" : "Enregistrer"}
        </button>
        {state === "saved" && <p className="text-[13px] font-medium text-emerald-600">✓ Modifications enregistrées</p>}
      </div>
    </form>
  );
}
