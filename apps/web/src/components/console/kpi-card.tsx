import type { ReactNode } from "react";

type KpiTone = "blue" | "teal" | "violet" | "orange" | "emerald" | "pink";

type KpiIcon = "calendar" | "users" | "heartbeat" | "wallet" | "chart";

type ToneConfig = {
  gradient: string;
  iconTint: string;
};

const TONE_CONFIG: Record<KpiTone, ToneConfig> = {
  blue: {
    gradient: "from-blue-600 via-blue-500 to-blue-500",
    iconTint: "text-blue-600",
  },
  teal: {
    gradient: "from-cyan-500 via-teal-500 to-teal-500",
    iconTint: "text-teal-600",
  },
  violet: {
    gradient: "from-violet-500 via-violet-400 to-indigo-400",
    iconTint: "text-violet-600",
  },
  orange: {
    gradient: "from-orange-400 via-orange-400 to-amber-400",
    iconTint: "text-orange-600",
  },
  emerald: {
    gradient: "from-emerald-500 via-emerald-400 to-teal-400",
    iconTint: "text-emerald-600",
  },
  pink: {
    gradient: "from-fuchsia-500 via-pink-500 to-rose-400",
    iconTint: "text-pink-600",
  },
};

const ICONS: Record<KpiIcon, ReactNode> = {
  calendar: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="4" width="14" height="16" rx="2" />
      <path d="M9 2v4M15 2v4M8 10h8M8 14h5" />
    </svg>
  ),
  users: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="8" r="3" />
      <circle cx="16" cy="9" r="2.5" />
      <path d="M4 18c0-3 2.5-5 5-5s5 2 5 5M12 18c.3-1.8 1.7-3.2 3.6-3.5" />
    </svg>
  ),
  heartbeat: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12h3l2-4 3 8 2-4h8" />
    </svg>
  ),
  wallet: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="7" width="16" height="12" rx="2" />
      <path d="M8 7V5a4 4 0 0 1 8 0v2" />
    </svg>
  ),
  chart: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3v18h18M7 14l3-3 3 2 5-5" />
    </svg>
  ),
};

export function KpiCard({
  label,
  value,
  sublabel,
  tone = "blue",
  icon = "chart",
  loading = false,
  showMenu = true,
  className = "",
}: {
  label: string;
  value: number | string;
  sublabel?: string;
  tone?: KpiTone;
  icon?: KpiIcon;
  loading?: boolean;
  showMenu?: boolean;
  className?: string;
}) {
  const config = TONE_CONFIG[tone];

  return (
    <article className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${config.gradient} p-4 text-white shadow-sm ${className}`}>
      <div className="pointer-events-none absolute -right-2 -bottom-3 h-14 w-14 rounded-full bg-white/15" />
      <div className="pointer-events-none absolute -right-6 -bottom-6 h-20 w-20 rounded-full border border-white/20" />
      {showMenu ? (
        <button
          type="button"
          aria-label={`${label} options`}
          className="absolute right-2 top-2 rounded-md p-1 text-white/80 transition hover:bg-white/15 hover:text-white"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M10 4a1.2 1.2 0 1 0 0-2.4A1.2 1.2 0 0 0 10 4Zm0 7.2A1.2 1.2 0 1 0 10 8.8a1.2 1.2 0 0 0 0 2.4Zm0 7.2a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Z" />
          </svg>
        </button>
      ) : null}
      <div className="flex items-start gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ${config.iconTint}`}>
          {ICONS[icon]}
        </span>
        <div>
          <p className="text-xs font-semibold tracking-wide text-white/90">{label}</p>
          {loading ? (
            <div className="mt-1 h-8 w-20 animate-pulse rounded bg-white/20" />
          ) : (
            <p className="mt-1 text-3xl font-black leading-none">{value}</p>
          )}
          {sublabel ? <p className="mt-1 text-[11px] font-semibold text-white/80">{sublabel}</p> : null}
        </div>
      </div>
    </article>
  );
}

export type { KpiTone, KpiIcon };
