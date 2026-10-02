import { ImageResponse } from "next/og";

export const alt = "SearchMeta: one saved search, every auction house";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The preview picture shown when a SearchMeta link is shared in a text, email or social post. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 96, background: "#0b0d10", color: "#e8ecf1" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 44 }}>
          <svg width="72" height="72" viewBox="0 0 64 64" fill="none">
            <path d="M8 12C28 12 26 32 44 32" stroke="#e8ecf1" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M8 25C24 25 28 32 44 32" stroke="#e8ecf1" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M8 39C24 39 28 32 44 32" stroke="#e8ecf1" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M8 52C28 52 26 32 44 32" stroke="#e8ecf1" strokeWidth="4.5" strokeLinecap="round" />
            <circle cx="50" cy="32" r="9" fill="#3ef08a" />
          </svg>
          <div style={{ display: "flex" }}>SearchMeta</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 56, fontSize: 92, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>
          <div style={{ display: "flex" }}>One saved search.</div>
          <div style={{ display: "flex" }}>Every auction house.</div>
        </div>
        <div style={{ display: "flex", marginTop: 40, fontSize: 34, color: "#3ef08a" }}>
          Get an alert the moment your card is listed.
        </div>
      </div>
    ),
    size,
  );
}
