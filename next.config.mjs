/** @type {import('next').NextConfig} */
const nextConfig = {
  // InsForge SDK y su dependencia son pure-ESM — Next.js necesita transpilarlos
  transpilePackages: ["@insforge/sdk", "@insforge/shared-schemas"],

  // Puppeteer y Chromium son módulos nativos con binarios grandes.
  // Hay que excluirlos del bundle de webpack para que se carguen en runtime.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium-min"],

  // Aumentar el límite de body para el proxy de upload de vídeos (hasta 512 MB)
  experimental: {
    serverActions: {
      bodySizeLimit: "512mb",
    },
  },

  async headers() {
    return [
      {
        // Cross-Origin Isolation — necesario para que SharedArrayBuffer esté disponible
        // en iOS Safari (15.2+). Sin esto, ffmpeg.wasm no puede arrancar en iPhone/iPad.
        //
        // COOP: same-origin  → aísla la ventana de cross-origin openers (no rompe nada)
        // COEP: credentialless → permite cargar recursos cross-origin (imágenes de InsForge,
        //   etc.) sin credenciales; no requiere que InsForge añada CORP headers propios.
        //   Más seguro que 'require-corp' para evitar romper el storage de InsForge.
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy",   value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy",  value: "credentialless" },
        ],
      },
      {
        // El binario WASM es inmutable (versionado) → cachear 1 año en el browser.
        // Así el usuario lo descarga solo una vez (~31 MB) y queda cacheado.
        source: "/ffmpeg/:path*",
        headers: [
          { key: "Content-Type",   value: "application/wasm" },
          { key: "Cache-Control",  value: "public, max-age=31536000, immutable" },
          // Necesario para que el WASM se cargue bajo COEP credentialless
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
      },
    ];
  },

  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.insforge.app",
      },
    ],
    // Permitir SVGs del public folder
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;
