export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="14" fill="#13161b" />
      <circle cx="28" cy="28" r="13" fill="none" stroke="#3ef08a" strokeWidth="5" />
      <path d="M38 38 L50 50" stroke="#3ef08a" strokeWidth="6" strokeLinecap="round" />
      <circle cx="28" cy="28" r="4" fill="#3ef08a" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2 text-lg font-bold tracking-tight">
      <Logo />
      Search<span className="text-signal">Meta</span>
    </span>
  );
}
