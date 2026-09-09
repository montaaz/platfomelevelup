import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // standalone output: `npm run build` produces a self-contained server bundle,
  // ideal to run behind a reverse proxy (Nginx) with PM2.
  output: "standalone",
  // separate build folder for verification runs (never clashes with the dev server's .next)
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // dev only: hosts allowed to load /_next/* when the server is reached by IP or domain
  // instead of localhost. Extend with DEV_ORIGINS="ip,domaine" if needed.
  allowedDevOrigins: [
    "31.70.137.202",
    "levelupia.app",
    ...(process.env.DEV_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean) ?? []),
  ],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
