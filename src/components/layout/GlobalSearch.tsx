"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { gql } from "@/lib/gqlClient";
import { IconSearch } from "@/components/icons";

type Hit = { type: string; title: string; subtitle: string | null; badge: string | null; href: string };

const TYPE_LABEL: Record<string, string> = {
  client: "Client", project: "Projet", invoice: "Facture", team: "Équipe", message: "Message", file: "Fichier",
};
const TYPE_STYLE: Record<string, string> = {
  client: "bg-brand-50 text-brand-600", project: "bg-violet-50 text-violet-600", invoice: "bg-emerald-50 text-emerald-600",
  team: "bg-amber-50 text-amber-600", message: "bg-sky-50 text-sky-600", file: "bg-slate-100 text-ink/70",
};

export function GlobalSearch({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  // debounced query
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setHits([]); setLoading(false); return; }
    setLoading(true);
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const data = await gql<{ search: Hit[] }>(`query($q: String!) { search(q: $q) { type title subtitle badge href } }`, { q: term });
        if (mine === seq.current) { setHits(data.search); setActive(0); }
      } catch { if (mine === seq.current) setHits([]); }
      finally { if (mine === seq.current) setLoading(false); }
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function go(hit: Hit) {
    setOpen(false);
    setQ("");
    if (hit.href.startsWith("/api/")) window.location.href = hit.href; else router.push(hit.href);
  }

  const groups = Array.from(new Set(hits.map((h) => h.type)));
  const showPanel = open && q.trim().length >= 2;

  return (
    <div ref={wrapRef} className="relative flex-1 sm:w-64 lg:w-80">
      <label className="relative block">
        <IconSearch width={16} height={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink/45" />
        <input
          type="search"
          value={q}
          placeholder={placeholder}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setOpen(false); (e.target as HTMLInputElement).blur(); }
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            if (e.key === "Enter" && hits[active]) { e.preventDefault(); go(hits[active]!); }
          }}
          className="w-full rounded-full border border-white/80 bg-white/60 py-2.5 pr-4 pl-10 text-[13px] shadow-sm backdrop-blur-xl outline-none placeholder:text-ink/45 focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
          aria-label="Recherche"
          autoComplete="off"
        />
      </label>

      {showPanel && (
        <div className="glass-strong absolute right-0 left-0 z-40 mt-2 max-h-[70vh] overflow-y-auto rounded-2xl sm:left-auto sm:w-[min(92vw,460px)]">
          {loading && hits.length === 0 && <p className="px-4 py-4 text-[13px] text-ink/60">Recherche…</p>}
          {!loading && hits.length === 0 && (
            <p className="px-4 py-6 text-center text-[13px] text-ink/60">Aucun résultat pour « {q.trim()} ».</p>
          )}
          {groups.map((type) => (
            <div key={type}>
              <p className="px-4 pt-3 pb-1 text-[10.5px] font-semibold tracking-[0.12em] text-ink/55 uppercase">
                {TYPE_LABEL[type] ?? type}s
              </p>
              {hits.map((h, i) => h.type === type && (
                <button
                  key={i}
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(h)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${i === active ? "bg-brand-50/80" : "hover:bg-white/60"}`}
                >
                  <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${TYPE_STYLE[h.type] ?? ""}`}>
                    {TYPE_LABEL[h.type] ?? h.type}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink">{h.title}</span>
                    {h.subtitle && <span className="block truncate text-[11.5px] text-ink/60">{h.subtitle}</span>}
                  </span>
                  {h.badge && <span className="shrink-0 text-[11px] font-medium text-ink/65">{h.badge}</span>}
                </button>
              ))}
            </div>
          ))}
          {hits.length > 0 && <p className="px-4 py-2 text-[10.5px] text-ink/45">↑↓ pour naviguer · Entrée pour ouvrir</p>}
        </div>
      )}
    </div>
  );
}
