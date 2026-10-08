// Build em uma cópia descartável: travamentos não renomeiam nem alteram fontes.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { copyPortableTree, assertPortableLinks } = require('./focused-web-runtime.cjs');
const root = path.resolve(__dirname, '..');
const web = path.join(root, 'apps/web');
const scope = require('../packages/shared/src/product-scope.json');
const staging = fs.mkdtempSync(path.join(root, 'apps/.focused-web-'));
const parked = scope.parkedWebRoutes.flatMap(route => ['app/(app)', 'app'].map(group => path.join(web, group, route.slice(1))));
try {
  fs.cpSync(web, staging, { recursive: true, verbatimSymlinks: true, filter: file => {
    const relative = path.relative(web, file);
    return !['.next', 'public-active', 'tsconfig.tsbuildinfo'].some(name => relative === name || relative.startsWith(name + path.sep))
      && !parked.some(dir => file === dir || file.startsWith(dir + path.sep));
  } });
  const out = spawnSync('pnpm', ['exec', 'next', 'build'], { cwd: staging, stdio: 'inherit', env: process.env });
  if (out.error) throw out.error;
  process.exitCode = out.status ?? 1;
  if (out.status === 0) {
    // O standalone deve manter o caminho de runtime original, apps/web.
    const traced = path.join(staging, '.next/standalone/apps', path.basename(staging));
    const runtime = path.join(staging, '.next/standalone/apps/web');
    if (!fs.existsSync(traced)) throw new Error('Standalone do build focado não encontrado.');
    fs.renameSync(traced, runtime);
    const output = path.join(web, '.next');
    if (fs.existsSync(output)) fs.rmSync(output, { recursive: true });
    copyPortableTree(path.join(staging, '.next'), output);
    console.log(`Standalone: ${assertPortableLinks(path.join(output, 'standalone'))} links portaveis verificados.`);
    const publicOutput = path.join(web, 'public-active');
    if (fs.existsSync(publicOutput)) fs.rmSync(publicOutput, { recursive: true });
    fs.cpSync(path.join(web, 'public'), publicOutput, { recursive: true, filter: file => !file.startsWith(path.join(web, 'public/models/face')) });
    // Pronto para smoke local com o mesmo server.js usado na imagem Docker.
    fs.cpSync(path.join(web, '.next/static'), path.join(output, 'standalone/apps/web/.next/static'), { recursive: true });
    fs.cpSync(publicOutput, path.join(output, 'standalone/apps/web/public'), { recursive: true });
  }
} finally {
  // Somente a cópia gerada por este processo é removida.
  fs.rmSync(staging, { recursive: true, force: true });
}
