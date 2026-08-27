"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-xl btn-3d bg-gradient-to-r from-brand-500 to-violet-500 px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-md shadow-brand-500/25 hover:opacity-95"
    >
      Imprimer / PDF
    </button>
  );
}
