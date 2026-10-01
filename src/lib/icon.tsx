import { ImageResponse } from "next/og";

/** App icon / favicon: the converge mark on the ink background, inset for maskable safe zone. */
export function renderIcon(size: number) {
  const mark = Math.round(size * 0.72);
  return new ImageResponse(
    (
      <div
        style={{
          width: size, height: size, background: "#0b0d10", display: "flex",
          alignItems: "center", justifyContent: "center",
        }}
      >
        <svg width={mark} height={mark} viewBox="0 0 64 64" fill="none">
          <path d="M8 12C28 12 26 32 44 32" stroke="#e8ecf1" strokeWidth="4.5" strokeLinecap="round" />
          <path d="M8 25C24 25 28 32 44 32" stroke="#e8ecf1" strokeWidth="4.5" strokeLinecap="round" />
          <path d="M8 39C24 39 28 32 44 32" stroke="#e8ecf1" strokeWidth="4.5" strokeLinecap="round" />
          <path d="M8 52C28 52 26 32 44 32" stroke="#e8ecf1" strokeWidth="4.5" strokeLinecap="round" />
          <circle cx="50" cy="32" r="9" fill="#3ef08a" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
