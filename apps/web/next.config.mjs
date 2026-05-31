/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Necessário porque @g360/shared e workspace local em TypeScript
  transpilePackages: ['@g360/shared'],
  // Saída self-contained para Docker (gera .next/standalone com server.js)
  output: 'standalone',
  // Next 15: outputFileTracingRoot saiu de `experimental` para top-level.
  // Em monorepo, indica para o Next rastrear arquivos a partir da raiz
  // para que .next/standalone inclua o packages/shared.
  outputFileTracingRoot: process.cwd().endsWith('apps/web')
    ? new URL('../../', import.meta.url).pathname
    : undefined,
  // Esconde o header "X-Powered-By: Next.js" (reduz fingerprinting).
  poweredByHeader: false,
  // Cabecalhos de seguranca aplicados a todas as respostas servidas pelo Next.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Anti-clickjacking
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // Impede sniffing de MIME
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Nao vaza URL completa para origens externas
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Desliga APIs sensiveis do navegador por padrao
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // Forca HTTPS por 2 anos (efetivo apenas sob TLS/dominio)
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};

export default nextConfig;
