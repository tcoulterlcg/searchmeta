import { ImageResponse } from "next/og";

export function renderIcon(size: number) {
  const s = size / 64;
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, background: "#0b0d10", display: "flex", position: "relative" }}>
        <div
          style={{
            position: "absolute", left: 15 * s, top: 15 * s, width: 26 * s, height: 26 * s,
            borderRadius: "50%", border: `${5 * s}px solid #3ef08a`, display: "flex",
            alignItems: "center", justifyContent: "center",
          }}
        >
          <div style={{ width: 8 * s, height: 8 * s, borderRadius: "50%", background: "#3ef08a" }} />
        </div>
        <div
          style={{
            position: "absolute", left: 36 * s, top: 41 * s, width: 17 * s, height: 6 * s,
            background: "#3ef08a", borderRadius: 3 * s, transform: "rotate(45deg)",
          }}
        />
      </div>
    ),
    { width: size, height: size },
  );
}
