"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { countryFlag } from "@/lib/countries";

export type CountryOption = {
  code: string | null;
  name: string;
  clients: number;
  confirmed: number;
};

/**
 * Sélecteur de pays de la barre supérieure (admin).
 *
 * Le pays choisi vit dans l'URL (`?pays=`) et non dans un état local : le
 * filtre survit au rechargement, se partage par lien et reste lisible dans
 * l'historique du navigateur.
 */
/**
 * `useSearchParams` impose une frontière Suspense : sans elle, toute la page
 * qui contient la barre serait rendue à la demande.
 */
export function CountryFilter({ countries }: { countries: CountryOption[] }) {
  return (
    <Suspense fallback={<div className="h-[34px] w-[2.6rem] shrink-0 rounded-xl bg-white/50 sm:w-[9rem]" />}>
      <CountryFilterInner countries={countries} />
    </Suspense>
  );
}

function CountryFilterInner({ countries }: { countries: CountryOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selected = params.get("pays");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function choose(name: string | null) {
    const next = new URLSearchParams(params.toString());
    if (name) next.set("pays", name);
    else next.delete("pays");
    setOpen(false);
    router.push(`${pathname}${next.toString() ? `?${next}` : ""}`);
  }

  const total = countries.reduce((sum, c) => sum + c.clients, 0);
  const current = selected ? countries.find((c) => c.name === selected) : null;

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Filtrer par pays"
        aria-expanded={open}
        className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-[12.5px] font-semibold transition ${
          selected
            ? "border-brand-500/30 bg-brand-500/10 text-brand-600"
            : "border-white/80 bg-white/70 text-ink/70 hover:text-ink"
        }`}
      >
        <span className="text-[15px] leading-none">
          {current ? countryFlag(current.code) : "🌍"}
        </span>
        <span className="hidden max-w-[7.5rem] truncate sm:inline">
          {current ? current.name : "Tous les pays"}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={`transition ${open ? "rotate-180" : ""}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 max-h-[22rem] w-64 overflow-y-auto rounded-2xl border border-white/80 bg-white/95 p-1.5 shadow-xl backdrop-blur">
          <button
            type="button"
            onClick={() => choose(null)}
            className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] transition hover:bg-brand-500/8 ${
              !selected ? "bg-brand-500/10 font-semibold text-brand-600" : "text-ink/80"
            }`}
          >
            <span className="text-[16px] leading-none">🌍</span>
            <span className="flex-1">Tous les pays</span>
            <span className="text-[11.5px] text-ink/50">{total}</span>
          </button>

          {countries.length > 0 && <div className="my-1.5 h-px bg-ink/6" />}

          {countries.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => choose(c.name)}
              className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] transition hover:bg-brand-500/8 ${
                selected === c.name ? "bg-brand-500/10 font-semibold text-brand-600" : "text-ink/80"
              }`}
            >
              <span className="text-[16px] leading-none">{countryFlag(c.code)}</span>
              <span className="min-w-0 flex-1 truncate">
                {c.name}
                {c.confirmed === 0 && (
                  <span className="ml-1 text-[10.5px] font-normal text-ink/45">détecté</span>
                )}
              </span>
              <span className="text-[11.5px] text-ink/50">{c.clients}</span>
            </button>
          ))}

          {countries.length === 0 && (
            <p className="px-2.5 py-3 text-[12.5px] text-ink/55">Aucun pays enregistré pour l&apos;instant.</p>
          )}
        </div>
      )}
    </div>
  );
}
