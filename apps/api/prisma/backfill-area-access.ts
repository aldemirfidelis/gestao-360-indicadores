/**
 * Backfill idempotente do controle de acesso por área (multiempresa).
 * - Garante uma área "Área não classificada" (OrgNode tipo AREA) por empresa.
 * - Usuários NÃO administradores sem área principal recebem a área não classificada.
 * - Registra um UserAreaAssignment PRIMARY para a área principal de cada usuário.
 *
 * Seguro para rodar mais de uma vez. Execute com:
 *   pnpm -C apps/api exec tsx prisma/backfill-area-access.ts
 */
import { PrismaClient, UserRoleEnum } from '@prisma/client';

const prisma = new PrismaClient();
const UNCLASSIFIED = 'Área não classificada';
const COMPANY_WIDE = new Set<string>([UserRoleEnum.SUPER_ADMIN, UserRoleEnum.COMPANY_ADMIN]);

async function main() {
  const companies = await prisma.company.findMany({ where: { deletedAt: null }, select: { id: true, name: true } });
  let createdAreas = 0;
  let assignedPrimary = 0;
  let assignments = 0;

  for (const company of companies) {
    // 1) Garante a área "não classificada"
    let unclassified = await prisma.orgNode.findFirst({
      where: { companyId: company.id, name: UNCLASSIFIED, deletedAt: null },
      select: { id: true },
    });
    if (!unclassified) {
      unclassified = await prisma.orgNode.create({
        data: { companyId: company.id, name: UNCLASSIFIED, type: 'AREA', position: 999, active: true },
        select: { id: true },
      });
      createdAreas += 1;
    }

    // 2) Usuários da empresa
    const users = await prisma.user.findMany({
      where: { companyId: company.id, deletedAt: null },
      select: { id: true, role: true, defaultNodeId: true },
    });

    for (const u of users) {
      let primaryArea = u.defaultNodeId;
      // Não-admins sem área principal recebem a área não classificada.
      if (!primaryArea && !COMPANY_WIDE.has(u.role)) {
        await prisma.user.update({ where: { id: u.id }, data: { defaultNodeId: unclassified.id } });
        primaryArea = unclassified.id;
        assignedPrimary += 1;
      }
      // 3) Registra a atribuição PRIMARY (idempotente pela unique [userId, orgNodeId]).
      if (primaryArea) {
        await prisma.userAreaAssignment.upsert({
          where: { userId_orgNodeId: { userId: u.id, orgNodeId: primaryArea } },
          create: { userId: u.id, companyId: company.id, orgNodeId: primaryArea, assignmentType: 'PRIMARY', isPrimary: true },
          update: { assignmentType: 'PRIMARY', isPrimary: true, companyId: company.id },
        });
        assignments += 1;
      }
    }
  }

  console.log(JSON.stringify({ companies: companies.length, createdAreas, assignedPrimary, assignments }, null, 2));
}

main()
  .catch((e) => {
    console.error('BACKFILL ERROR', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
