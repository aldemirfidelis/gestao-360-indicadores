import bundleAnalyzer from '@next/bundle-analyzer';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const webPackage = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

function resolveAppVersion() {
  if (process.env.NEXT_PUBLIC_APP_VERSION) return process.env.NEXT_PUBLIC_APP_VERSION;

  try {
    const repositoryRoot = new URL('../../', import.meta.url);
    const commit = execFileSync('git', ['rev-parse', '--short=8', 'HEAD'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return `${webPackage.version}+${commit}`;
  } catch {
    return `${webPackage.version}+dev`;
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Uma versão rastreável é injetada no bundle. Em deploy ela vem do commit;
  // em desenvolvimento o fallback também consulta o Git local.
  env: {
    NEXT_PUBLIC_APP_VERSION: resolveAppVersion(),
  },
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
          // Camera e geolocalizacao liberadas apenas para a propria origem
          // (ponto facial, leitura de QR e batida com localizacao); iframes de
          // terceiros continuam bloqueados. Microfone segue desligado.
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(self)' },
          // Forca HTTPS por 2 anos (efetivo apenas sob TLS/dominio)
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
