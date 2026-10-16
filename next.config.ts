import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Protege a lógica do produto: o código do navegador não expõe o código-fonte.
  productionBrowserSourceMaps: false,
  experimental: {
    // Foto do modelo: o navegador já reduz a imagem, e o servidor recusa mais de 2 MB.
    serverActions: { bodySizeLimit: "2mb" },
  },
  async redirects() {
    return [
      // A página Equipe passou a se chamar Usuários.
      { source: "/equipe", destination: "/usuarios", permanent: true },
      { source: "/equipe/:path*", destination: "/usuarios/:path*", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        // Página do convite: nunca guardar em cache nem indexar.
        source: "/convite/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
