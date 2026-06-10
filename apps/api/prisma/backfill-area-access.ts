/**
 * Backfill idempotente do controle de acesso por area (multiempresa).
 * - Nao cria area provisoria nem "Area nao classificada".
 * - Usuarios sem area principal permanecem sem defaultNodeId.
 * - Registra UserAreaAssignment PRIMARY apenas para area real ja vinculada.
 *
 * Seguro para rodar mais de uma vez. Execute com:
 *   pnpm -C apps/api exec tsx prisma/backfill-area-access.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const companies = await prisma.company.findMany({ where: { deletedAt: null }, select: { id: true, name: true } });
  let assignments = 0;
  let skippedWithoutPrimaryArea = 0;

  for (const company of companies) {
    const users = await prisma.user.findMany({
      where: { companyId: company.id, deletedAt: null },
      select: { id: true, defaultNodeId: true },
    });

    for (const user of users) {
      if (!user.defaultNodeId) {
        skippedWithoutPrimaryArea += 1;
        continue;
      }

      const area = await prisma.orgNode.findFirst({
        where: { id: user.defaultNodeId, companyId: company.id, deletedAt: null },
        select: { id: true },
      });
      if (!area) {
        skippedWithoutPrimaryArea += 1;
        continue;
      }

      await prisma.userAreaAssignment.upsert({
        where: { userId_orgNodeId: { userId: user.id, orgNodeId: area.id } },
        create: { userId: user.id, companyId: company.id, orgNodeId: area.id, assignmentType: 'PRIMARY', isPrimary: true },
        update: { assignmentType: 'PRIMARY', isPrimary: true, companyId: company.id },
      });
      assignments += 1;
    }
  }

  console.log(JSON.stringify({ companies: companies.length, assignments, skippedWithoutPrimaryArea }, null, 2));
}

main()
  .catch((e) => {
    console.error('BACKFILL ERROR', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
