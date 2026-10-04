import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GrailFindr",
    short_name: "GrailFindr",
    description: "Every marketplace. One search.",
    start_url: "/alerts",
    display: "standalone",
    background_color: "#0b0d10",
    theme_color: "#0b0d10",
    icons: [
      // Rounded tile for desktop shortcuts and docks; full-bleed square for phones that cut their own shape.
      { src: "/icons/192?v=3", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512?v=3", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/192?v=3&shape=full", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/512?v=3&shape=full", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
