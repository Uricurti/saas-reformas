/** @type {import('next').NextConfig} */
const nextConfig = {
  // InsForge SDK y su dependencia son pure-ESM — Next.js necesita transpilarlos
  transpilePackages: ["@insforge/sdk", "@insforge/shared-schemas"],

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
