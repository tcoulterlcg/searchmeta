import { ImageResponse } from "next/og";

/**
 * App icon / favicon: the converge mark on the ink background.
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
            <path d="M8 12C28 12 26 32 44 32" stroke="#e8ecf1" strokeWidth="5" strokeLinecap="round" />
            <path d="M8 25C24 25 28 32 44 32" stroke="#e8ecf1" strokeWidth="5" strokeLinecap="round" />
            <path d="M8 39C24 39 28 32 44 32" stroke="#e8ecf1" strokeWidth="5" strokeLinecap="round" />
            <path d="M8 52C28 52 26 32 44 32" stroke="#e8ecf1" strokeWidth="5" strokeLinecap="round" />
            <circle cx="50" cy="32" r="9.5" fill="#3ef08a" />
          </svg>
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
