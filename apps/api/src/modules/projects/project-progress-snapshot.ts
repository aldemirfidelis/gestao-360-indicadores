import type { Prisma } from '@prisma/client';
import { projectMeasurementDay, projectProgress } from '@g360/shared';
import type { PrismaService } from '../../prisma/prisma.service';

/** Todos os caminhos de atualização (projeto e quadro de tarefas) usam a mesma medição. */
export async function withProjectProgressSnapshot<T>(
  prisma: PrismaService,
  projectId: string,
  write: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  return prisma.$transaction(async (tx) => {
    // Serializa alterações do mesmo projeto antes de calcular a medição diária.
    await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${projectId} FOR UPDATE`;
    const result = await write(tx);
    const project = await tx.project.findUniqueOrThrow({
      where: { id: projectId }, include: { tasks: true, milestones: true },
    });
    const measuredOn = projectMeasurementDay();
    const progress = projectProgress(project);
    await tx.projectProgressSnapshot.upsert({
      where: { projectId_measuredOn: { projectId, measuredOn } },
      create: { projectId, measuredOn, progress },
      update: { progress },
    });
    return result;
  });
}
