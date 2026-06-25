/**
 * Backfill de `slug` (subdomínio) das empresas existentes — multi-tenant por host.
 *
 * - Gera o slug a partir de tradeName/name (sem acentos, minúsculo, hífens).
 * - Idempotente: só preenche empresas com slug ainda nulo; não toca nas demais.
 * - Garante unicidade (sufixo -2, -3, ...) e evita subdomínios reservados.
 *
 * Rodar:  pnpm -C apps/api exec tsx prisma/backfill-company-slug.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Mantém em sincronia com RESERVED_SUBDOMAINS em src/common/tenant-host.ts.
const RESERVED = new Set(['www', 'api', 'app', 'admin', 'platform', 'collabora', 'static', 'assets', 'cdn', 'mail']);

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos (marcas diacríticas combinantes)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // não-alfanumérico -> hífen
    .replace(/^-+|-+$/g, '') // tira hífens das pontas
    .replace(/-{2,}/g, '-'); // colapsa hífens repetidos
}

async function main() {
  const companies = await prisma.company.findMany({
    where: { slug: null, deletedAt: null },
    select: { id: true, name: true, tradeName: true },
    orderBy: { createdAt: 'asc' },
  });

  if (companies.length === 0) {
    console.log('Nada a fazer: todas as empresas já possuem slug.');
    return;
  }

  // Slugs já em uso (de empresas que não entram no backfill) para evitar colisão.
  const existing = await prisma.company.findMany({
    where: { slug: { not: null } },
    select: { slug: true },
  });
  const taken = new Set<string>(existing.map((c) => c.slug!).filter(Boolean));

  for (const c of companies) {
    let base = slugify(c.tradeName || c.name) || `empresa-${c.id.slice(0, 8)}`;
    if (RESERVED.has(base)) base = `${base}-org`;
    let slug = base;
    let n = 2;
    while (taken.has(slug)) {
      slug = `${base}-${n}`;
      n += 1;
    }
    taken.add(slug);
    await prisma.company.update({ where: { id: c.id }, data: { slug } });
    console.log(`  ${c.tradeName || c.name}  ->  ${slug}`);
  }

  console.log(`\nOK: ${companies.length} empresa(s) atualizada(s).`);
}

main()
  .catch((err) => {
    console.error('Falha no backfill de slug:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
