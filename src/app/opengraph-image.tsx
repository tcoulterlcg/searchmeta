import { ImageResponse } from "next/og";

export const alt = "GrailFindr: every marketplace, one search";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The preview picture shown when a GrailFindr link is shared in a text, email or social post. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 96, background: "#0b0d10", color: "#e8ecf1" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 44 }}>
          <svg width="72" height="72" viewBox="0 0 64 64" fill="none">
            <path d="M47.6 16.4A22 22 0 1 0 54 32H37" stroke="#e8ecf1" strokeWidth="8" />
            <path d="M38 24.5 25 32l13 7.5Z" fill="#e8ecf1" />
            <circle cx="32" cy="32" r="12.5" stroke="#3ef08a" strokeWidth="3" />
            <path d="M32 2v15M32 47v15M2 32h15" stroke="#3ef08a" strokeWidth="3" />
          </svg>
          <div style={{ display: "flex", fontWeight: 800, letterSpacing: 2 }}>GRAILFINDR</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 56, fontSize: 92, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>
          <div style={{ display: "flex" }}>Every marketplace.</div>
          <div style={{ display: "flex" }}>One search.</div>
        </div>
        <div style={{ display: "flex", marginTop: 40, fontSize: 34, color: "#3ef08a" }}>
          Get an alert the moment your card is listed.
        </div>
      </div>
    ),
    size,
  );
}
