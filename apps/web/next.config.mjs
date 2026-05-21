/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Necessario porque @g360/shared e workspace local em TypeScript
  transpilePackages: ['@g360/shared'],
  // Saida self-contained para Docker (gera .next/standalone com server.js)
  output: 'standalone',
  // Em monorepo, indica para o Next rastrear arquivos a partir da raiz
  // para que .next/standalone inclua o packages/shared
  outputFileTracingRoot: process.cwd().endsWith('apps/web')
    ? new URL('../../', import.meta.url).pathname
    : undefined,
  experimental: {
    typedRoutes: false,
  },
};

export default nextConfig;
