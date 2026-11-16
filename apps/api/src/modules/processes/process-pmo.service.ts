import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import type { AuthPayload } from '../auth/auth.types';
import { ProjectsService } from '../projects/projects.service';
import { ProcessesService } from './processes.service';
import { ProcessLinksService } from './process-links.service';

const FINAL_STATUSES = new Set(['DONE', 'CANCELLED']);
const PMO_SEVERITY: Record<string, number> = { CRITICAL: 3, AT_RISK: 2, ON_TRACK: 1, FINALIZED: 0 };

type PmoProject = {
  id: string;
  code: string | null;
  name: string;
  status: string;
  budget: number | null;
  progressOverall: number;
  expectedProgress: number | null;
  pmoStatus: string;
  tasksOverdue: number;
  milestonesOverdue: number;
  openRisks: number;
  openIssues: number;
  finance?: { actualCost: number };
  milestones?: Array<{ name: string; dueDate: Date | string; done: boolean }>;
};

function mean(values: number[]): number | null {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

/** Indicadores PMO de um conjunto de projetos (cancelados não entram em avanço nem em custo). */
function summarize(projects: PmoProject[]) {
  const counted = projects.filter((project) => project.status !== 'CANCELLED');
  const active = projects.filter((project) => !FINAL_STATUSES.has(project.status));
  const sum = (items: PmoProject[], value: (project: PmoProject) => number) => items.reduce((total, project) => total + value(project), 0);
  const nextMilestone = active
    .flatMap((project) => (project.milestones ?? []).filter((milestone) => !milestone.done).map((milestone) => ({
      name: milestone.name,
      dueDate: new Date(milestone.dueDate).toISOString(),
      project: { id: project.id, code: project.code, name: project.name },
    })))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] ?? null;
  const worst = active.reduce<string | null>((current, project) => (
    current === null || (PMO_SEVERITY[project.pmoStatus] ?? 0) > (PMO_SEVERITY[current] ?? 0) ? project.pmoStatus : current
  ), null);
  return {
    projects: projects.length,
    active: active.length,
    done: projects.filter((project) => project.status === 'DONE').length,
    avgProgress: mean(counted.map((project) => project.progressOverall)),
    expectedProgress: mean(counted.flatMap((project) => (project.expectedProgress === null ? [] : [project.expectedProgress]))),
    critical: active.filter((project) => project.pmoStatus === 'CRITICAL').length,
    atRisk: active.filter((project) => project.pmoStatus === 'AT_RISK').length,
    tasksOverdue: sum(active, (project) => project.tasksOverdue ?? 0),
    milestonesOverdue: sum(active, (project) => project.milestonesOverdue ?? 0),
    openRisks: sum(active, (project) => project.openRisks ?? 0),
    openIssues: sum(active, (project) => project.openIssues ?? 0),
    budget: sum(counted, (project) => project.budget ?? 0),
    actualCost: sum(counted, (project) => project.finance?.actualCost ?? 0),
    pmoStatus: worst ?? (projects.length ? 'FINALIZED' : null),
    nextMilestone,
  };
}

/**
 * PMO integrado a Processos. Projetos de melhoria são projetos do módulo Projetos ligados ao
 * processo pelo mesmo vínculo tipado de "Registros relacionados" (sem cadastro paralelo).
 */
@Injectable()
export class ProcessPmoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly processes: ProcessesService,
    private readonly links: ProcessLinksService,
    private readonly projects: ProjectsService,
    private readonly access: AccessService,
  ) {}

  /** Acesso ao módulo Projetos: licença da empresa, perfil e permissões do usuário. */
  private async projectAccess(me: AuthPayload) {
    const context = await this.links.context(me);
    const canView = this.links.canRead(context, 'PROJECT');
    const has = (key: string) => context.admin || context.permissions.has(key) || context.permissions.has('projects:manage');
    return { canView, canCreate: canView && has('projects:create') };
  }

  /** Cria um projeto já vinculado ao processo como projeto de melhoria. */
  async createImprovementProject(me: AuthPayload, processId: string, body: unknown) {
    // Valida o processo (empresa, área e situação) antes de criar qualquer registro.
    const process = await this.processes.getById(me, processId);
    if (process.status === 'ARCHIVED') throw new ConflictException('Reative o processo antes de vincular projetos de melhoria.');
    if (process.areaId) await this.access.assertCanWrite(me.sub, process.areaId, 'processes', 'edit');
    const { canCreate } = await this.projectAccess(me);
    if (!canCreate) throw new ForbiddenException('Você não tem permissão para criar projetos.');

    const project = await this.projects.create(me, (body ?? {}) as any);
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.processIntegration.create({
          data: {
            processId,
            scopeKey: 'PROCESS',
            targetKey: `PROJECT:${project.id}`,
            projectId: project.id,
            label: 'Projeto de melhoria',
          },
        });
        const metadata = { type: 'PROJECT', targetId: project.id, code: project.code, created: true };
        await tx.auditLog.create({
          data: {
            companyId: me.companyId,
            userId: me.sub,
            module: 'Processos',
            entity: 'Process',
            entityId: processId,
            action: 'LINK_PROCESS',
            payload: JSON.stringify(metadata),
            result: 'SUCCESS',
          },
        });
        await tx.traceabilityEvent.create({
          data: {
            companyId: me.companyId,
            userId: me.sub,
            entityType: 'PROCESS',
            entityId: processId,
            eventType: 'UPDATED',
            title: 'Projeto de melhoria criado',
            description: [project.code, project.name].filter(Boolean).join(' · '),
            metadata,
          },
        });
      });
    } catch (error) {
      // Sem o vínculo, o projeto criado agora não deve ficar solto no portfólio.
      await this.prisma.project.update({ where: { id: project.id }, data: { deletedAt: new Date() } }).catch(() => undefined);
      throw error;
    }
    return project;
  }

  /** Painel PMO dos processos visíveis: projetos de melhoria, avanço, prazos, custos e riscos. */
  async overview(me: AuthPayload) {
    const { canView, canCreate } = await this.projectAccess(me);
    if (!canView) return { available: false as const, canCreate: false };

    const processes: any[] = await this.processes.list(me, {});
    const processIds = processes.map((process) => process.id);
    const links = processIds.length
      ? await this.prisma.processIntegration.findMany({
          where: { processId: { in: processIds }, projectId: { not: null } },
          select: { processId: true, projectId: true },
        })
      : [];
    const linkedIds = [...new Set(links.map((link) => link.projectId as string))];
    // A lista de projetos aplica empresa, exclusão e área visível do módulo Projetos.
    const visible = (await this.projects.list(me, { ids: linkedIds })) as unknown as PmoProject[];
    const byId = new Map(visible.map((project) => [project.id, project]));

    const rows = processes
      .map((process) => {
        const ids = [...new Set(links.filter((link) => link.processId === process.id).map((link) => link.projectId as string))];
        const projects = ids.map((id) => byId.get(id)).filter((project): project is PmoProject => Boolean(project));
        if (!projects.length) return null;
        return {
          process: {
            id: process.id,
            number: process.number,
            code: process.code ?? null,
            name: process.name,
            status: process.status,
            orgNode: process.orgNode ? { id: process.orgNode.id, name: process.orgNode.name } : null,
            owner: process.owner ? { id: process.owner.id, name: process.owner.name } : null,
          },
          ...summarize(projects),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => b.critical - a.critical || b.atRisk - a.atRisk || a.process.name.localeCompare(b.process.name, 'pt-BR'));

    return {
      available: true as const,
      canCreate,
      totals: {
        processes: processes.length,
        withProjects: rows.length,
        hiddenProjects: linkedIds.length - visible.length,
        ...summarize(visible),
      },
      processes: rows,
    };
  }
}
