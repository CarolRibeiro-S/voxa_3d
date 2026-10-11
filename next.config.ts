import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Protege a lógica do produto: o código do navegador não expõe o código-fonte.
  productionBrowserSourceMaps: false,
};

export default nextConfig;
