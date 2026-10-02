"use client";

import { useMemo, useRef, useState } from "react";

/** One past sale: when it sold (ms) and for how much. */
export interface PricePoint {
  t: number;
  p: number;
}

const RANGES = [
  { id: "3m", label: "3M", days: 92 },
  { id: "1y", label: "1Y", days: 366 },
  { id: "5y", label: "5Y", days: 5 * 366 },
  { id: "all", label: "All", days: Infinity },
] as const;
type RangeId = (typeof RANGES)[number]["id"];

const DAY = 86_400_000;
const W = 640;
const H = 220;
const PAD = { l: 8, r: 56, t: 12, b: 24 };

const money = (n: number) =>
  n >= 1000 ? `$${Math.round(n).toLocaleString("en-US")}` : `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Round axis steps: 1, 2, 2.5 or 5 times a power of ten. */
function niceStep(span: number, ticks: number) {
  const raw = span / ticks;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
}

interface Bucket {
  t: number;
  median: number;
  n: number;
}

/**
 * Price trend for a sold search: the median sale price per week or month, as a line.
 * Hover or drag across it to read any point.
 */
export function PriceChart({ points }: { points: PricePoint[] }) {
  const [range, setRange] = useState<RangeId>("all");
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const newest = useMemo(() => points.reduce((m, x) => Math.max(m, x.t), 0), [points]);

  const buckets = useMemo<Bucket[]>(() => {
    const days = RANGES.find((r) => r.id === range)!.days;
    const from = days === Infinity ? -Infinity : newest - days * DAY;
    const inRange = points.filter((x) => x.t >= from);
    // Weeks for short ranges, months for long ones.
    const key = (t: number) => {
      const d = new Date(t);
      if (days <= 366) return Math.floor(t / (7 * DAY)) * 7 * DAY;
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 15);
    };
    const groups = new Map<number, number[]>();
    for (const x of inRange) {
      const k = key(x.t);
      const g = groups.get(k);
      if (g) g.push(x.p);
      else groups.set(k, [x.p]);
    }
    return [...groups.entries()]
      .map(([t, ps]) => ({ t, median: median(ps), n: ps.length }))
      .sort((a, b) => a.t - b.t);
  }, [points, range, newest]);

  if (points.length < 3) return null;

  const controls = (
    <div className="flex gap-1" role="group" aria-label="Time range">
      {RANGES.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => {
            setRange(r.id);
            setHover(null);
          }}
          aria-pressed={range === r.id}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
            range === r.id ? "bg-signal/10 text-signal" : "text-muted hover:text-text"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );

  if (buckets.length < 2) {
    return (
      <section className="mt-5 rounded-xl border border-line bg-panel p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-muted">Price trend</div>
          {controls}
        </div>
        <p className="py-8 text-center text-sm text-muted">Not enough sales in this period to draw a trend.</p>
      </section>
    );
  }

  const t0 = buckets[0].t;
  const t1 = buckets[buckets.length - 1].t;
  const lo = Math.min(...buckets.map((b) => b.median));
  const hi = Math.max(...buckets.map((b) => b.median));
  const step = niceStep(Math.max(hi - lo, hi * 0.1, 1), 3);
  const yMin = Math.max(0, Math.floor(lo / step) * step);
  const yMax = Math.max(yMin + step, Math.ceil(hi / step) * step);
  const x = (t: number) => PAD.l + ((t - t0) / Math.max(1, t1 - t0)) * (W - PAD.l - PAD.r);
  const y = (p: number) => PAD.t + (1 - (p - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);

  const line = buckets.map((b, i) => `${i ? "L" : "M"}${x(b.t).toFixed(1)} ${y(b.median).toFixed(1)}`).join("");
  const area = `${line}L${x(t1).toFixed(1)} ${y(yMin)}L${x(t0).toFixed(1)} ${y(yMin)}Z`;
  const yTicks: number[] = [];
  for (let v = yMin; v <= yMax + step / 2; v += step) yTicks.push(v);

  const spanDays = (t1 - t0) / DAY;
  const xLabel = (t: number) =>
    new Date(t).toLocaleDateString("en-US", spanDays > 800 ? { year: "numeric" } : { month: "short", year: "2-digit" });
  const xTicks = [t0, t0 + (t1 - t0) / 2, t1];

  const first = buckets[0];
  const last = buckets[buckets.length - 1];
  const shown = hover != null ? buckets[hover] : last;
  const change = first.median > 0 ? (last.median - first.median) / first.median : 0;
  const up = change >= 0;

  const onMove = (clientX: number) => {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box) return;
    const t = t0 + ((((clientX - box.left) / box.width) * W - PAD.l) / (W - PAD.l - PAD.r)) * (t1 - t0);
    let best = 0;
    for (let i = 1; i < buckets.length; i++) if (Math.abs(buckets[i].t - t) < Math.abs(buckets[best].t - t)) best = i;
    setHover(best);
  };

  return (
    <section className="mt-5 rounded-xl border border-line bg-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs text-muted">
            Price trend · median sale{" "}
            {hover != null
              ? `· ${new Date(shown.t).toLocaleDateString("en-US", spanDays > 366 ? { month: "short", year: "numeric" } : { month: "short", day: "numeric", year: "numeric" })}`
              : ""}
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
            <span className="text-2xl font-semibold tabular-nums">{money(shown.median)}</span>
            {hover != null ? (
              <span className="text-sm text-muted">
                {shown.n} {shown.n === 1 ? "sale" : "sales"}
              </span>
            ) : (
              <span className="text-sm tabular-nums text-text">
                <span aria-hidden className={up ? "text-signal" : "text-warn"}>
                  {up ? "▲" : "▼"}
                </span>{" "}
                {up ? "+" : "−"}
                {Math.abs(change * 100).toFixed(1)}% <span className="text-muted">over this period</span>
              </span>
            )}
          </div>
        </div>
        {controls}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full touch-none select-none"
        role="img"
        aria-label={`Median sale price from ${xLabel(t0)} to ${xLabel(t1)}: ${money(first.median)} to ${money(last.median)}`}
        onMouseMove={(e) => onMove(e.clientX)}
        onMouseLeave={() => setHover(null)}
        onTouchStart={(e) => onMove(e.touches[0].clientX)}
        onTouchMove={(e) => onMove(e.touches[0].clientX)}
        onTouchEnd={() => setHover(null)}
      >
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeWidth="1" />
            <text x={W - PAD.r + 6} y={y(v) + 4} fontSize="11" fill="var(--color-muted)">
              {money(v)}
            </text>
          </g>
        ))}
        {xTicks.map((t, i) => (
          <text
            key={i}
            x={x(t)}
            y={H - 6}
            fontSize="11"
            fill="var(--color-muted)"
            textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
          >
            {xLabel(t)}
          </text>
        ))}
        <path d={area} fill="var(--color-signal)" opacity="0.1" />
        <path d={line} fill="none" stroke="var(--color-signal)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {hover != null && (
          <line x1={x(shown.t)} x2={x(shown.t)} y1={PAD.t} y2={H - PAD.b} stroke="var(--color-muted)" strokeWidth="1" />
        )}
        <circle cx={x(shown.t)} cy={y(shown.median)} r="4.5" fill="var(--color-signal)" stroke="var(--color-panel)" strokeWidth="2" />
      </svg>
    </section>
  );
}
