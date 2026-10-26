import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react"],
    // Fotos (ya reducidas en el cliente) para la ficha con IA de la toma de inventario.
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
