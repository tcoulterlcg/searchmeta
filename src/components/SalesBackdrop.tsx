"use client";

import { useEffect, useRef } from "react";

export interface BackdropSale {
  title: string;
  price: string;
  source: string;
}

interface Row {
  text: string;
  /** Where each price sits in the row, in characters, so it can be drawn brighter. */
  prices: { at: number; len: number }[];
  /** Where each whole sale sits, for the "match found" flash. */
  sales: { at: number; len: number }[];
  speed: number;
  offset: number;
}

const FONT_PX = 12;
const ROW_PX = 17;
const SEP = "   ·   ";

function buildRow(sales: BackdropSale[], start: number, minChars: number): Row {
  let text = "";
  const prices: Row["prices"] = [];
  const spans: Row["sales"] = [];
  for (let i = 0; text.length < minChars && i < sales.length; i++) {
    const s = sales[(start + i) % sales.length];
    const head = `${s.title}  `;
    const at = text.length;
    prices.push({ at: at + head.length, len: s.price.length });
    text += `${head}${s.price}  ${s.source}`;
    spans.push({ at, len: text.length - at });
    text += SEP;
  }
  return { text, prices, sales: spans, speed: 5 + Math.random() * 9, offset: Math.random() * 400 };
}

/**
 * Full-page backdrop of real sold prices drifting past on a curved "screen".
 * Purely decorative: hidden from screen readers, still when the visitor prefers reduced motion.
 */
export function SalesBackdrop({ sales }: { sales: BackdropSale[] }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || sales.length < 20) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let rows: Row[] = [];
    let w = 0;
    let h = 0;
    let charW = 7;
    let dim = "#8a94a3";
    let bright = "#3ef08a";
    let flash: { row: number; at: number; len: number; t0: number } | null = null;
    let nextFlash = 1200;
    let raf = 0;
    let last = 0;

    const font = `${FONT_PX}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;

    function setup() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.font = font;
      charW = ctx!.measureText("0").width || 7;
      const css = getComputedStyle(document.documentElement);
      dim = css.getPropertyValue("--color-muted").trim() || dim;
      bright = css.getPropertyValue("--color-signal").trim() || bright;
      // Each row holds enough text to cover the widest (middle) row twice over, so it can loop.
      const minChars = Math.ceil((w * 1.3) / charW) + 40;
      const count = Math.ceil(h / ROW_PX) + 2;
      rows = Array.from({ length: count }, (_, i) => buildRow(sales, (i * 7) % sales.length, minChars));
    }

    function draw(now: number) {
      const dt = last ? Math.min(now - last, 100) / 1000 : 0;
      last = now;
      ctx!.clearRect(0, 0, w, h);
      ctx!.font = font;
      ctx!.textBaseline = "middle";

      if (!still && now > nextFlash) {
        const row = Math.floor(Math.random() * rows.length);
        const pick = rows[row].sales[Math.floor(Math.random() * rows[row].sales.length)];
        if (pick) flash = { row, at: pick.at, len: pick.len, t0: now };
        nextFlash = now + 1400 + Math.random() * 1600;
      }

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const loop = r.text.length * charW;
        r.offset = (r.offset + r.speed * dt * (i % 2 ? 1 : -1) + loop) % loop;

        // Curved screen: rows near the middle are wider and spaced further apart.
        const d = (i / (rows.length - 1)) * 2 - 1; // -1 top … 1 bottom
        const bulge = 1 - d * d;
        const scale = 1 + 0.22 * bulge;
        const y = h / 2 + Math.sin((d * Math.PI) / 2) * (h / 2 + ROW_PX);

        ctx!.save();
        ctx!.translate(w / 2, y);
        ctx!.scale(scale, 0.8 + 0.2 * bulge);
        const half = w / 2 / scale;
        for (let x = -half - r.offset; x < half; x += loop) {
          ctx!.globalAlpha = 0.22;
          ctx!.fillStyle = dim;
          ctx!.fillText(r.text, x, 0);
          ctx!.globalAlpha = 0.45;
          ctx!.fillStyle = bright;
          for (const p of r.prices) {
            const px = x + p.at * charW;
            if (px > half || px + p.len * charW < -half) continue;
            ctx!.fillText(r.text.substr(p.at, p.len), px, 0);
          }
          if (flash && flash.row === i) {
            const age = (now - flash.t0) / 1800;
            if (age >= 1) flash = null;
            else {
              ctx!.globalAlpha = Math.sin(age * Math.PI);
              ctx!.fillText(r.text.substr(flash.at, flash.len), x + flash.at * charW, 0);
            }
          }
        }
        ctx!.restore();
      }
      if (!still) raf = requestAnimationFrame(draw);
    }

    function start() {
      cancelAnimationFrame(raf);
      last = 0;
      setup();
      raf = requestAnimationFrame(draw);
    }
    const onVisible = () => {
      cancelAnimationFrame(raf);
      last = 0;
      if (!document.hidden) raf = requestAnimationFrame(draw);
    };

    start();
    window.addEventListener("resize", start);
    document.addEventListener("visibilitychange", onVisible);
    // Re-read colours when the theme changes.
    const theme = new MutationObserver(start);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", start);
      document.removeEventListener("visibilitychange", onVisible);
      theme.disconnect();
    };
  }, [sales]);

  return (
    <div aria-hidden="true" className="sales-backdrop pointer-events-none fixed inset-0 -z-10">
      <canvas ref={ref} className="h-full w-full" />
    </div>
  );
}
