/** Profile badges: who someone is in the GrailFindr rollout. Order here is display order. */
export const BADGES = ["founder", "partner", "alpha", "beta"] as const;
export type Badge = (typeof BADGES)[number];

const LABEL: Record<Badge, string> = { founder: "Founder", partner: "Partner", alpha: "Alpha", beta: "Beta" };

const TONE: Record<Badge, string> = {
  founder: "border-warn/50 bg-warn/10 text-warn",
  partner: "border-signal/50 bg-signal/10 text-signal",
  alpha: "border-text/30 bg-text/5 text-text",
  beta: "border-line bg-ink text-muted",
};

function Icon({ badge }: { badge: Badge }) {
  const common = { width: 12, height: 12, viewBox: "0 0 24 24", "aria-hidden": true } as const;
  if (badge === "founder") {
    // Crown
    return (
      <svg {...common} fill="currentColor">
        <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-1.8 10H4.8L3 8z" />
      </svg>
    );
  }
  if (badge === "partner") {
    // Two linked rings
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth="2.6">
        <circle cx="8.5" cy="12" r="5" />
        <circle cx="15.5" cy="12" r="5" />
      </svg>
    );
  }
  return <span aria-hidden className="text-[13px] font-bold leading-none">{badge === "alpha" ? "α" : "β"}</span>;
}

export function badgeLabel(badge: Badge) {
  return LABEL[badge];
}

/** One badge pill: icon plus name. */
export function BadgePill({ badge }: { badge: Badge }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${TONE[badge]}`}>
      <Icon badge={badge} />
      {LABEL[badge]}
    </span>
  );
}

/** A member's badges in a row. Renders nothing when there are none. */
export function BadgeRow({ badges, className = "" }: { badges: Badge[]; className?: string }) {
  if (!badges.length) return null;
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {badges.map((b) => <BadgePill key={b} badge={b} />)}
    </div>
  );
}
