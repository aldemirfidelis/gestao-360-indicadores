import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TrainingAssignmentStatus, TrainingRevisionAction } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { TrainingMatrixService } from './training-matrix.service';

export interface RevisionOutcome {
  trainingId: string;
  trainingName: string;
  action: TrainingRevisionAction;
  reopened: number;
}

/**
 * Integração com o GED (Evento 3 do plano).
 *
 * Quando um documento controlado ganha nova revisão, quem já foi treinado na
 * versão anterior pode precisar de ciência, reciclagem ou novo treinamento.
 * A decisão vem de `Training.revisionAction`, e pode ser sobreposta por quem
 * publica a revisão.
 *
 * O histórico anterior NUNCA é apagado: a célula reabre e o campo
 * `trainedDocumentVersion` continua registrando em que revisão a pessoa foi
 * treinada — é o que responde "quem ainda não viu a versão atual".
 */
@Injectable()
export class TrainingDocumentService {
  private readonly logger = new Logger(TrainingDocumentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly matrix: TrainingMatrixService,
  ) {}

  /** Treinamentos vinculados a um documento (usado pela tela do GED). */
  async trainingsForDocument(companyId: string, documentId: string) {
    const [linked, origins] = await Promise.all([
      this.prisma.training.findMany({
        where: { companyId, documentId, deletedAt: null },
        select: {
          id: true, code: true, name: true, status: true, documentVersion: true, revisionAction: true,
          _count: { select: { assignments: true } },
        },
      }),
      this.prisma.trainingRequirement.findMany({
        where: { companyId, originDocumentId: documentId, deletedAt: null, active: true },
        select: { id: true, training: { select: { id: true, code: true, name: true } }, target: true, targetId: true },
      }),
    ]);
    return { trainings: linked, requirements: origins };
  }

  /**
   * Aplica a revisão. Chamado na publicação do documento (ação padrão de cada
   * treinamento) ou pela tela, quando o responsável escolhe outra ação.
   */
  async applyRevision(
    companyId: string,
    documentId: string,
    options: { action?: TrainingRevisionAction; jobIds?: string[]; actorUserId?: string | null } = {},
  ): Promise<RevisionOutcome[]> {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, companyId, deletedAt: null },
      select: { id: true, version: true, code: true, title: true },
    });
    if (!document) throw new NotFoundException('Documento não encontrado.');

    const trainings = await this.prisma.training.findMany({
      where: { companyId, documentId, deletedAt: null, status: 'ACTIVE' },
      select: { id: true, name: true, revisionAction: true, documentVersion: true },
    });
    if (trainings.length === 0) return [];

    const outcomes: RevisionOutcome[] = [];

    for (const training of trainings) {
      const action = options.action ?? training.revisionAction;

      // A versão vigente do treinamento passa a ser a nova revisão publicada.
      await this.prisma.training.update({
        where: { id: training.id },
        data: { documentVersion: document.version },
      });

      if (action === TrainingRevisionAction.NONE) {
        outcomes.push({ trainingId: training.id, trainingName: training.name, action, reopened: 0 });
        continue;
      }

      // Alvo: quem está com a célula resolvida numa revisão anterior à publicada.
      const candidates = await this.prisma.trainingAssignment.findMany({
        where: {
          companyId,
          trainingId: training.id,
          deletedAt: null,
          status: { in: TrainingMatrixService.SETTLED },
          OR: [{ trainedDocumentVersion: null }, { trainedDocumentVersion: { lt: document.version } }],
          employee: { status: 'ACTIVE' },
        },
        select: { id: true, employeeId: true, trainedDocumentVersion: true, employee: { select: { jobId: true } } },
        take: 5000,
      });

      const affected =
        action === TrainingRevisionAction.RETRAIN_SPECIFIC_JOBS
          ? candidates.filter((row) => row.employee.jobId && (options.jobIds ?? []).includes(row.employee.jobId))
          : candidates;

      if (affected.length === 0) {
        outcomes.push({ trainingId: training.id, trainingName: training.name, action, reopened: 0 });
        continue;
      }

      await this.prisma.trainingAssignment.updateMany({
        where: { id: { in: affected.map((row) => row.id) } },
        data: {
          status: TrainingAssignmentStatus.PENDING,
          // A conclusão anterior deixa de valer para a versão nova, mas a
          // revisão treinada continua gravada para rastreio.
          result: 'PENDING',
          classId: null,
        },
      });

      await this.prisma.trainingHistoryEntry.createMany({
        data: affected.map((row) => ({
          companyId,
          employeeId: row.employeeId,
          assignmentId: row.id,
          trainingId: training.id,
          event: 'DOCUMENT_REVISED',
          description: `${document.code ? `${document.code} — ` : ''}${document.title} passou para a revisão ${document.version}`,
          previousValue: row.trainedDocumentVersion ? `Revisão ${row.trainedDocumentVersion}` : 'Sem revisão registrada',
          newValue: `Revisão ${document.version}`,
          reason: this.reasonOf(action),
          actorUserId: options.actorUserId ?? null,
          source: 'training-document',
        })),
      });

      outcomes.push({ trainingId: training.id, trainingName: training.name, action, reopened: affected.length });
    }

    return outcomes;
  }

  /** Endpoint da tela: o responsável escolhe a ação da revisão. */
  async decideRevision(me: AuthPayload, documentId: string, body: any) {
    const action = body?.action as TrainingRevisionAction;
    if (!action || !Object.values(TrainingRevisionAction).includes(action)) {
      throw new BadRequestException('Informe o que a revisão exige de quem já foi treinado.');
    }
    if (action === TrainingRevisionAction.RETRAIN_SPECIFIC_JOBS && !(body?.jobIds ?? []).length) {
      throw new BadRequestException('Selecione os cargos que precisam refazer o treinamento.');
    }
    return this.applyRevision(me.companyId, documentId, {
      action,
      jobIds: body?.jobIds ?? [],
      actorUserId: me.sub,
    });
  }

  /** Define a ação padrão do treinamento para futuras revisões. */
  async setRevisionAction(me: AuthPayload, trainingId: string, action: TrainingRevisionAction) {
    if (!Object.values(TrainingRevisionAction).includes(action)) {
      throw new BadRequestException('Ação inválida.');
    }
    const training = await this.prisma.training.findFirst({
      where: { id: trainingId, companyId: me.companyId, deletedAt: null },
      select: { id: true },
    });
    if (!training) throw new NotFoundException('Treinamento não encontrado.');
    return this.prisma.training.update({
      where: { id: trainingId },
      data: { revisionAction: action },
      select: { id: true, revisionAction: true },
    });
  }

  /**
   * Quem ainda não foi treinado na revisão atual do documento.
   * Responde diretamente a pergunta 12 do plano.
   */
  async outdatedForDocument(companyId: string, documentId: string) {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, companyId, deletedAt: null },
      select: { id: true, code: true, title: true, version: true },
    });
    if (!document) throw new NotFoundException('Documento não encontrado.');

    const rows = await this.prisma.trainingAssignment.findMany({
      where: {
        companyId,
        deletedAt: null,
        training: { documentId, deletedAt: null },
        employee: { status: 'ACTIVE' },
        OR: [{ trainedDocumentVersion: null }, { trainedDocumentVersion: { lt: document.version } }],
      },
      include: {
        employee: {
          select: { id: true, name: true, registrationId: true, job: { select: { name: true } }, orgNode: { select: { name: true } } },
        },
        training: { select: { id: true, code: true, name: true } },
      },
      take: 2000,
    });

    return {
      document,
      items: rows.map((row) => ({
        employeeId: row.employeeId,
        name: row.employee.name,
        registrationId: row.employee.registrationId,
        job: row.employee.job?.name ?? null,
        area: row.employee.orgNode?.name ?? null,
        training: row.training,
        status: row.status,
        trainedDocumentVersion: row.trainedDocumentVersion,
      })),
    };
  }

  private reasonOf(action: TrainingRevisionAction): string {
    const reasons: Record<TrainingRevisionAction, string> = {
      NONE: 'Revisão não exige novo treinamento',
      ACKNOWLEDGE: 'Exige ciência da nova versão',
      RETRAIN_SPECIFIC_JOBS: 'Exige novo treinamento para cargos específicos',
      RETRAIN_ALL: 'Exige novo treinamento para todo o público vinculado',
      RECYCLE_PREVIOUS_VERSIONS: 'Exige reciclagem de quem foi treinado em versões anteriores',
    };
    return reasons[action];
  }
}
