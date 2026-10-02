import { ImageResponse } from "next/og";

/**
 * App icon / favicon: the searchlight mark (G, arrow and green crosshair) on the ink background.
 *
 * - "tile" (default): a rounded square with clear corners, the shape desktop shortcuts, browser
 *   tabs and Windows/Mac docks show as-is. A hairline edge keeps it visible on dark wallpapers.
 * - "full": a full-bleed square with the mark kept inside the middle, for phones that cut their
 *   own shape out of the icon (Android adaptive icons, the iPhone home screen).
 */
export function renderIcon(size: number, shape: "tile" | "full" = "tile") {
  const tile = shape === "tile";
  const mark = Math.round(size * (tile ? 0.66 : 0.58));
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, display: "flex", background: tile ? "transparent" : "#0b0d10" }}>
        <div
          style={{
            width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center",
            background: "linear-gradient(160deg, #161a20 0%, #0b0d10 70%)",
            borderRadius: tile ? Math.round(size * 0.225) : 0,
            border: tile ? `${Math.max(1, Math.round(size / 96))}px solid #2a303a` : "none",
          }}
        >
          <svg width={mark} height={mark} viewBox="0 0 64 64" fill="none">
            <path d="M47.6 16.4A22 22 0 1 0 54 32H37" stroke="#e8ecf1" strokeWidth="8" strokeLinecap="butt" strokeLinejoin="miter" />
            <path d="M38 24.5 25 32l13 7.5Z" fill="#e8ecf1" />
            <circle cx="32" cy="32" r="12.5" stroke="#3ef08a" strokeWidth="3" />
            <path d="M32 2v15M32 47v15M2 32h15" stroke="#3ef08a" strokeWidth="3" strokeLinecap="butt" />
          </svg>
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
