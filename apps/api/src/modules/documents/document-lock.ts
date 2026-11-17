import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** Serializa alterações da revisão: conteúdo, participantes e decisões usam a mesma linha. */
export async function lockDocument(tx: Prisma.TransactionClient, companyId: string, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "Document"
    WHERE "id" = ${id} AND "companyId" = ${companyId} AND "deletedAt" IS NULL FOR UPDATE`;
  const current = await tx.document.findFirst({ where: { id, companyId, deletedAt: null } });
  if (!current) throw new NotFoundException('Documento não encontrado.');
  return current;
}

/** Rejeita trabalho calculado sobre conteúdo/estado que mudou enquanto a operação aguardava. */
export async function assertDocumentUnchanged(
  tx: Prisma.TransactionClient,
  companyId: string,
  expected: { id: string; status: string; updatedAt?: Date },
) {
  const current = await lockDocument(tx, companyId, expected.id);
  if (current.status !== expected.status || (expected.updatedAt && current.updatedAt.getTime() !== expected.updatedAt.getTime())) {
    throw new ConflictException('O documento mudou durante esta operação. Atualize a página e tente novamente.');
  }
  return current;
}
