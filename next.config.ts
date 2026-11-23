import type { NextConfig } from "next";

// Security headers for every page: no framing by other sites (clickjacking), no MIME sniffing,
// no full URLs leaked to other sites, and no access to camera / microphone / location.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// Data Management > Setup pages all live under /management/setup/<page>. /management/setup opens the first page;
// the old Batch Setup URLs (/batch/setup/<panel>) keep working for bookmarks. Temporary (307), so a later change
// of these paths is not stuck in browser caches.
export const setupRedirects = [
  { source: "/management/setup", destination: "/management/setup/dropdowns", permanent: false },
  { source: "/batch/setup/dyeing", destination: "/management/setup/dyeing-mc", permanent: false },
  { source: "/batch/setup/flat", destination: "/management/setup/flat-allowance", permanent: false },
  { source: "/batch/setup/unit", destination: "/management/setup/unit", permanent: false },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  async redirects() {
    return setupRedirects;
  },
};

export default nextConfig;
