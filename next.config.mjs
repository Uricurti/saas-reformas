/** @type {import('next').NextConfig} */
const nextConfig = {
  // InsForge SDK y su dependencia son pure-ESM — Next.js necesita transpilarlos
  transpilePackages: ["@insforge/sdk", "@insforge/shared-schemas"],

  // Aumentar el límite de body para el proxy de upload de vídeos (hasta 512 MB)
  experimental: {
    serverActions: {
      bodySizeLimit: "512mb",
    },
  },

  async headers() {
    return [
      {
        // El binario WASM es inmutable (versionado) → cachear 1 año en el browser.
        // Así el usuario lo descarga solo una vez (~31 MB) y queda cacheado.
        source: "/ffmpeg/:path*",
        headers: [
          { key: "Content-Type",   value: "application/wasm" },
          { key: "Cache-Control",  value: "public, max-age=31536000, immutable" },
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
