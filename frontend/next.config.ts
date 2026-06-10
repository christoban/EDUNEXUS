import type { NextConfig } from "next";
import path from "path";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";

// Hostname ngrok injecté par start-dev.mjs (change à chaque démarrage)
const NGROK_HOSTNAME = process.env.NGROK_HOSTNAME

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },

  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'images.unsplash.com' }],
  },

  // Permet au hot-reload (HMR) de fonctionner depuis le domaine ngrok
  ...(NGROK_HOSTNAME ? { allowedDevOrigins: [NGROK_HOSTNAME] } : {}),

  /**
   * Proxy toutes les requêtes /api/v2/* vers le backend Express.
   * Avantages :
   *  - Un seul tunnel ngrok suffit (port 3000 seulement)
   *  - Pas de CORS : le browser voit une seule origine
   *  - Les cookies httpOnly fonctionnent (même domaine ngrok)
   *  - Le téléphone n'a pas besoin d'atteindre localhost:5000 directement
   */
  async rewrites() {
    return [
      {
        source: "/api/v2/:path*",
        destination: `${BACKEND_URL}/api/v2/:path*`,
      },
      {
        source: "/api/master/:path*",
        destination: `${BACKEND_URL}/api/master/:path*`,
      },
    ];
  },

};

export default nextConfig;
