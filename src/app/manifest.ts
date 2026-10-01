import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SearchMeta",
    short_name: "SearchMeta",
    description: "One saved search across every auction house.",
    start_url: "/alerts",
    display: "standalone",
    background_color: "#0b0d10",
    theme_color: "#0b0d10",
    icons: [
      { src: "/icons/192?v=2", sizes: "192x192", type: "image/png" },
      { src: "/icons/512?v=2", sizes: "512x512", type: "image/png" },
      { src: "/icons/512?v=2", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
