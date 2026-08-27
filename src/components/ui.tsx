import type { ReactNode } from "react";
import { initials } from "@/lib/format";
import {
  IconArrowRight, IconFolder, IconChat, IconInvoice, IconFile, IconClock, IconUsers, IconRepeat, IconPlus, IconGrid, IconTrend,
} from "@/components/icons";

/* section icon derived from the title — one look everywhere, zero call-site changes */
function headerIcon(title: string): { Icon: (p: { width?: number; height?: number }) => ReactNode; tone: string } {
  const t = title.toLowerCase();
  if (t.includes("chiffre")) return { Icon: IconTrend, tone: "from-brand-400 to-brand-600" };
  if (t.includes("revenu")) return { Icon: IconGrid, tone: "from-violet-400 to-violet-600" };
  if (t.includes("livrable") || t.includes("fichier")) return { Icon: IconFile, tone: "from-sky-400 to-brand-500" };
  if (t.includes("avancement") || t.includes("étape") || t.includes("historique")) return { Icon: IconClock, tone: "from-indigo-400 to-violet-600" };
  if (t.includes("messag") || t.includes("conversation")) return { Icon: IconChat, tone: "from-fuchsia-400 to-violet-600" };
  if (t.includes("factur")) return { Icon: IconInvoice, tone: "from-emerald-400 to-teal-600" };
  if (t.includes("client")) return { Icon: IconUsers, tone: "from-sky-400 to-brand-500" };
  if (t.includes("abonnement")) return { Icon: IconRepeat, tone: "from-amber-400 to-orange-500" };
  if (t.includes("demande")) return { Icon: IconPlus, tone: "from-pink-400 to-rose-500" };
  return { Icon: IconFolder, tone: "from-brand-400 to-violet-500" };
}

/* ------------------------------------------------------------------ Card */

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section data-tilt className={`glass relative min-w-0 rounded-2xl ${className}`}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 sm:px-6 sm:pt-5">
      <div className="flex min-w-0 items-start gap-3">
        {(() => {
          const { Icon, tone } = headerIcon(title);
          return (
            <span className={`keycap mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${tone} text-white`}>
              <Icon width={17} height={17} />
            </span>
          );
        })()}
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[12.5px] text-ink/72">{subtitle}</p>}
        </div>
      </div>
      {action && (
        <a
          href={action.href}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1.5 text-[13px] font-medium text-brand-600 hover:bg-brand-100 sm:bg-transparent sm:px-0 sm:py-0 sm:text-brand-500 sm:hover:bg-transparent sm:hover:text-brand-600"
          aria-label={action.label}
        >
          <span className="hidden sm:inline">{action.label}</span>
          <IconArrowRight width={14} height={14} />
        </a>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- Status pill */

const STATUS_STYLES: Record<string, string> = {
  EN_COURS: "bg-brand-50 text-brand-600",
  EN_REVISION: "bg-violet-50 text-violet-600",
  EN_ATTENTE: "bg-amber-50 text-amber-600",
  LIVRE: "bg-emerald-50 text-emerald-600",
  CLOTURE: "bg-slate-100 text-ink/72",
  PAYEE: "bg-emerald-50 text-emerald-600",
  EN_RETARD: "bg-red-50 text-red-600",
  BROUILLON: "bg-slate-100 text-ink/72",
  ANNULEE: "bg-slate-100 text-ink/60",
  ACTIF: "bg-emerald-50 text-emerald-600",
  NOUVELLE: "bg-brand-50 text-brand-600",
};

const STATUS_DOTS: Record<string, string> = {
  EN_COURS: "bg-brand-500",
  EN_REVISION: "bg-violet-500",
  EN_ATTENTE: "bg-amber-500",
  LIVRE: "bg-emerald-500",
  CLOTURE: "bg-slate-400",
  PAYEE: "bg-emerald-500",
  EN_RETARD: "bg-red-500",
  BROUILLON: "bg-slate-400",
  ANNULEE: "bg-slate-300",
  ACTIF: "bg-emerald-500",
  NOUVELLE: "bg-brand-500",
};

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium whitespace-nowrap ${STATUS_STYLES[status] ?? "bg-slate-100 text-ink/72"}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOTS[status] ?? "bg-slate-400"}`} />
      {label}
    </span>
  );
}

/* ---------------------------------------------------------------- Avatar */

const AVATAR_GRADIENTS = [
  "from-brand-500 to-violet-500",
  "from-violet-500 to-fuchsia-500",
  "from-sky-500 to-brand-500",
  "from-indigo-500 to-violet-500",
  "from-brand-600 to-sky-400",
];

export function Avatar({ name, size = 38 }: { name: string; size?: number }) {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) | 0;
  const gradient = AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
  return (
    <span
      className={`avatar-3d inline-flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} font-semibold text-white`}
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {initials(name)}
    </span>
  );
}

/* ---------------------------------------------------------- ProgressBar */

export function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className="h-full rounded-full btn-3d bg-gradient-to-r from-brand-500 to-violet-500"
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}

/* ------------------------------------------------------------ EmptyState */

export function EmptyState({ message }: { message: string }) {
  return <p className="px-6 py-10 text-center text-sm text-ink/60">{message}</p>;
}
