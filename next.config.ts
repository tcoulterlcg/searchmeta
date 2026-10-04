import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** The old address forwards to the new one. API and sign-in callbacks are left alone so nothing in flight breaks. */
  async redirects() {
    return [
      {
        source: "/:path((?!api/|auth/).*)",
        has: [{ type: "host", value: "searchmeta.vercel.app" }],
        destination: "https://grailfindr.vercel.app/:path",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
