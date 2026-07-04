import type { NextConfig } from "next";

/**
 * Security-Headers für die gesamte Admin-App.
 *
 * - HSTS: erzwingt HTTPS ein Jahr lang (nur Prod-Effekt, admin.yusefbach.de).
 * - X-Frame-Options / frame-ancestors: verbietet Einbettung → Clickjacking-Schutz.
 * - X-Content-Type-Options: verhindert MIME-Sniffing.
 * - Referrer-Policy: verhindert Leak sensibler URLs an Dritte.
 * - Permissions-Policy: schaltet unnötige Browser-APIs ab.
 * - CSP: strikt genug, dass keine fremden Scripts/Frames geladen werden können,
 *   aber weich genug, dass Next.js + Supabase + framer-motion inline arbeiten.
 *   (Wir erlauben unsafe-inline für Style, weil Tailwind-runtime + framer-motion
 *   inline styles setzen. Scripts sind erlaubt via 'self' + Supabase CDN.)
 */
// Dev-Mode braucht 'unsafe-eval' für React DevTools + HMR. In Prod bleibt es aus.
const isDev = process.env.NODE_ENV !== "production";
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";

const cspDirectives = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://avatars.githubusercontent.com https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.github.com https://api.deepl.com https://api-free.deepl.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://github.com",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Content-Security-Policy", value: cspDirectives },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
