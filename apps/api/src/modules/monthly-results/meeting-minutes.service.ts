import { Injectable, NotFoundException } from '@nestjs/common';
import { ActionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { AuthPayload } from '../auth/auth.types';

const MODULE = 'actions';

/** Ações fechadas: não contam como pendência nem entram na curva de execução. */
const DONE_STATUSES: ActionStatus[] = [ActionStatus.DONE, ActionStatus.DONE_LATE, ActionStatus.EFFECTIVE];
const CANCELLED_STATUSES: ActionStatus[] = [ActionStatus.CANCELLED];

export type MinuteActionState = 'NAO_INICIADA' | 'EM_ANDAMENTO' | 'ENCERRADA' | 'CANCELADA';

interface MinuteAction {
  id: string;
  title: string;
  status: ActionStatus;
  /** Estado consolidado para a ata (o que o gestor lê na coluna Status). */
  state: MinuteActionState;
  overdue: boolean;
  progress: number;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  responsible: { id: string; name: string } | null;
  areaMacro: { id: string; name: string } | null;
  areaMicro: { id: string; name: string } | null;
  origin: string;
  indicator: { id: string; name: string; code: string | null } | null;
  deviation: { id: string; number: number; title: string } | null;
  meeting: { id: string; title: string; periodRef: string } | null;
  taskCount: number;
  taskDone: number;
  links: { action: string; indicator: string | null; deviation: string | null };
}

/**
 * ATA INTEGRADA da Reunião Mensal.
 *
 * Não cria uma base paralela de ações: lê os ActionPlan que nasceram das saídas
 * da reunião (decisões, planos vinculados a indicadores e escalonamentos) e os
 * organiza como a ata é lida em campo — por área, setor e responsável.
 */
@Injectable()
export class MeetingMinutesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  /** Reuniões disponíveis para o seletor da ata (mais recentes primeiro). */
  async meetings(me: AuthPayload) {
    return this.prisma.monthlyMeeting.findMany({
      where: { companyId: me.companyId, deletedAt: null },
      select: { id: true, title: true, periodRef: true, status: true, startsAt: true },
      orderBy: [{ periodRef: 'desc' }, { startsAt: 'desc' }],
      take: 24,
    });
  }

  /**
   * Ata de uma reunião (ou de todas as reuniões de uma competência), agrupada
   * em Área → Setor → Responsável.
   */
  async minutes(me: AuthPayload, query: { meetingId?: string; periodRef?: string; onlyOpen?: string }) {
    const meetingIds = await this.resolveMeetingIds(me, query);
    const actionIds = await this.actionIdsFromMeetings(me, meetingIds);

    const permitted = await this.access.listAreaFilter(me.sub, MODULE, 'view');
    const actions = actionIds.length
      ? await this.prisma.actionPlan.findMany({
          where: {
            id: { in: actionIds },
            companyId: me.companyId,
            deletedAt: null,
            ...(permitted ? { OR: [{ ownerNodeId: { in: permitted } }, { ownerNodeId: null }] } : {}),
          },
          select: {
            id: true,
            title: true,
            status: true,
            origin: true,
            progress: true,
            startDate: true,
            dueDate: true,
            completedAt: true,
            responsibleUser: { select: { id: true, name: true } },
            ownerNode: {
              select: {
                id: true,
                name: true,
                parentId: true,
                parent: { select: { id: true, name: true } },
              },
            },
            indicator: { select: { id: true, name: true, code: true } },
            deviation: { select: { id: true, number: true, title: true } },
            meeting: { select: { id: true, title: true } },
            tasks: { select: { done: true } },
          },
          orderBy: [{ dueDate: 'asc' }, { title: 'asc' }],
        })
      : [];

    const meetingById = new Map(
      (await this.prisma.monthlyMeeting.findMany({
        where: { id: { in: meetingIds } },
        select: { id: true, title: true, periodRef: true },
      })).map((m) => [m.id, m]),
    );
    const meetingOfAction = await this.meetingByAction(meetingIds);

    const onlyOpen = query.onlyOpen === '1' || query.onlyOpen === 'true';
    const rows: MinuteAction[] = [];
    for (const action of actions) {
      const state = this.stateOf(action.status);
      if (onlyOpen && (state === 'ENCERRADA' || state === 'CANCELADA')) continue;
      const meetingId = meetingOfAction.get(action.id) ?? action.meeting?.id ?? null;
      const meeting = meetingId ? meetingById.get(meetingId) ?? null : null;
      // Área/setor: quando o nó tem pai, o pai é a área e o nó é o setor.
      const node = action.ownerNode;
      const areaMacro = node ? (node.parent ? { id: node.parent.id, name: node.parent.name } : { id: node.id, name: node.name }) : null;
      const areaMicro = node?.parent ? { id: node.id, name: node.name } : null;
      rows.push({
        id: action.id,
        title: action.title,
        status: action.status,
        state,
        overdue:
          state !== 'ENCERRADA' &&
          state !== 'CANCELADA' &&
          Boolean(action.dueDate) &&
          (action.dueDate as Date).getTime() < Date.now(),
        progress: action.progress ?? 0,
        startDate: action.startDate?.toISOString() ?? null,
        dueDate: action.dueDate?.toISOString() ?? null,
        completedAt: action.completedAt?.toISOString() ?? null,
        responsible: action.responsibleUser,
        areaMacro,
        areaMicro,
        origin: action.origin,
        indicator: action.indicator,
        deviation: action.deviation,
        meeting: meeting ? { id: meeting.id, title: meeting.title, periodRef: meeting.periodRef } : null,
        taskCount: action.tasks.length,
        taskDone: action.tasks.filter((t) => t.done).length,
        links: {
          action: `/actions/${action.id}`,
          indicator: action.indicator ? `/indicators/${action.indicator.id}` : null,
          deviation: action.deviation ? `/deviations/${action.deviation.id}` : null,
        },
      });
    }

    return {
      meetings: meetingIds.map((id) => meetingById.get(id)).filter(Boolean),
      summary: this.summarize(rows),
      areas: this.groupByArea(rows),
    };
  }

  /**
   * Curva S de uma ação: avanço PLANEJADO (pelos prazos das tarefas, ou pela
   * reta início→fim quando não há tarefas) contra o REALIZADO (conclusões).
   * É o que responde "esta ação está no ritmo combinado na reunião?".
   */
  async curve(me: AuthPayload, actionId: string) {
    const action = await this.prisma.actionPlan.findFirst({
      where: { id: actionId, companyId: me.companyId, deletedAt: null },
      select: {
        id: true,
        title: true,
        status: true,
        progress: true,
        startDate: true,
        dueDate: true,
        completedAt: true,
        createdAt: true,
        responsibleUser: { select: { id: true, name: true } },
        tasks: {
          select: { id: true, title: true, done: true, dueDate: true, startDate: true, endDate: true, updatedAt: true },
          orderBy: [{ dueDate: 'asc' }, { position: 'asc' }],
        },
      },
    });
    if (!action) throw new NotFoundException('Ação não encontrada.');

    const start = action.startDate ?? action.createdAt;
    const end = action.dueDate ?? action.completedAt ?? new Date();
    const tasks = action.tasks;
    const state = this.stateOf(action.status);

    // Marcos do eixo do tempo: início, prazos das tarefas, fim e hoje.
    const stamps = new Set<number>();
    stamps.add(startOfDay(start));
    stamps.add(startOfDay(end));
    stamps.add(startOfDay(new Date()));
    for (const task of tasks) {
      if (task.dueDate) stamps.add(startOfDay(task.dueDate));
      const doneAt = task.endDate ?? (task.done ? task.updatedAt : null);
      if (doneAt) stamps.add(startOfDay(doneAt));
    }
    const timeline = [...stamps].filter((t) => Number.isFinite(t)).sort((a, b) => a - b);

    const total = tasks.length;
    const points = timeline.map((time) => {
      let planned: number;
      if (total > 0) {
        // Planejado = % de tarefas cujo prazo já venceu até esta data.
        const due = tasks.filter((task) => task.dueDate && startOfDay(task.dueDate) <= time).length;
        planned = round((due / total) * 100);
      } else {
        // Sem tarefas: avanço linear entre início e prazo (melhor que nada e
        // deixa claro o ritmo esperado).
        const spanStart = startOfDay(start);
        const spanEnd = startOfDay(end);
        const span = Math.max(1, spanEnd - spanStart);
        planned = round(clamp(((time - spanStart) / span) * 100, 0, 100));
      }

      let actual: number | null;
      if (time > startOfDay(new Date())) {
        actual = null; // futuro não tem realizado
      } else if (total > 0) {
        const done = tasks.filter((task) => {
          if (!task.done) return false;
          const doneAt = task.endDate ?? task.updatedAt;
          return doneAt ? startOfDay(doneAt) <= time : false;
        }).length;
        actual = round((done / total) * 100);
      } else {
        actual = null;
      }
      return { date: new Date(time).toISOString(), planned, actual };
    });

    // O último ponto realizado reflete o progresso oficial da ação: é o número
    // que o responsável mantém e o que a reunião cobra.
    const today = startOfDay(new Date());
    const current = state === 'ENCERRADA' ? 100 : round(action.progress ?? 0);
    for (let i = points.length - 1; i >= 0; i -= 1) {
      if (startOfDay(new Date(points[i].date)) <= today) {
        points[i] = { ...points[i], actual: current };
        break;
      }
    }

    const plannedNow = points.filter((p) => startOfDay(new Date(p.date)) <= today).pop()?.planned ?? 0;
    return {
      action: {
        id: action.id,
        title: action.title,
        status: action.status,
        state,
        progress: current,
        startDate: (action.startDate ?? action.createdAt).toISOString(),
        dueDate: action.dueDate?.toISOString() ?? null,
        completedAt: action.completedAt?.toISOString() ?? null,
        responsible: action.responsibleUser,
        taskCount: total,
        taskDone: tasks.filter((t) => t.done).length,
      },
      // Diferença entre o combinado e o feito, em pontos percentuais.
      deviationPp: round(current - plannedNow),
      points,
      tasks: tasks.map((task) => ({
        id: task.id,
        title: task.title,
        done: task.done,
        dueDate: task.dueDate?.toISOString() ?? null,
      })),
    };
  }

  // =========================================================================
  // Internos
  // =========================================================================

  private async resolveMeetingIds(me: AuthPayload, query: { meetingId?: string; periodRef?: string }) {
    if (query.meetingId) {
      const meeting = await this.prisma.monthlyMeeting.findFirst({
        where: { id: query.meetingId, companyId: me.companyId, deletedAt: null },
        select: { id: true },
      });
      if (!meeting) throw new NotFoundException('Reunião mensal não encontrada.');
      return [meeting.id];
    }
    const meetings = await this.prisma.monthlyMeeting.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        ...(query.periodRef ? { periodRef: query.periodRef } : {}),
      },
      select: { id: true },
      orderBy: [{ periodRef: 'desc' }, { startsAt: 'desc' }],
      // Sem competência escolhida, a ata cobre as reuniões recentes.
      take: query.periodRef ? 50 : 6,
    });
    return meetings.map((m) => m.id);
  }

  /**
   * Toda saída da reunião que virou ação: decisões, planos vinculados aos
   * indicadores apresentados, escalonamentos e ações criadas com a reunião
   * como origem.
   */
  private async actionIdsFromMeetings(me: AuthPayload, meetingIds: string[]) {
    if (!meetingIds.length) return [];
    const [indicators, decisions, followUps, byOrigin] = await Promise.all([
      this.prisma.monthlyMeetingIndicator.findMany({
        where: { meetingId: { in: meetingIds }, actionPlanId: { not: null } },
        select: { actionPlanId: true },
      }),
      this.prisma.monthlyMeetingDecision.findMany({
        where: { meetingId: { in: meetingIds }, actionPlanId: { not: null } },
        select: { actionPlanId: true },
      }),
      this.prisma.monthlyMeetingFollowUp.findMany({
        where: { meetingId: { in: meetingIds }, actionPlanId: { not: null } },
        select: { actionPlanId: true },
      }),
      this.prisma.actionPlan.findMany({
        where: { companyId: me.companyId, deletedAt: null, origin: 'MEETING', originRefId: { in: meetingIds } },
        select: { id: true },
      }),
    ]);
    const ids = new Set<string>();
    for (const row of indicators) if (row.actionPlanId) ids.add(row.actionPlanId);
    for (const row of decisions) if (row.actionPlanId) ids.add(row.actionPlanId);
    for (const row of followUps) if (row.actionPlanId) ids.add(row.actionPlanId);
    for (const row of byOrigin) ids.add(row.id);
    return [...ids];
  }

  /** De qual reunião veio cada ação (para exibir a origem na linha da ata). */
  private async meetingByAction(meetingIds: string[]) {
    const map = new Map<string, string>();
    if (!meetingIds.length) return map;
    const [indicators, decisions, followUps] = await Promise.all([
      this.prisma.monthlyMeetingIndicator.findMany({
        where: { meetingId: { in: meetingIds }, actionPlanId: { not: null } },
        select: { meetingId: true, actionPlanId: true },
      }),
      this.prisma.monthlyMeetingDecision.findMany({
        where: { meetingId: { in: meetingIds }, actionPlanId: { not: null } },
        select: { meetingId: true, actionPlanId: true },
      }),
      this.prisma.monthlyMeetingFollowUp.findMany({
        where: { meetingId: { in: meetingIds }, actionPlanId: { not: null } },
        select: { meetingId: true, actionPlanId: true },
      }),
    ]);
    for (const row of [...indicators, ...decisions, ...followUps]) {
      if (row.actionPlanId && !map.has(row.actionPlanId)) map.set(row.actionPlanId, row.meetingId);
    }
    return map;
  }

  private stateOf(status: ActionStatus): MinuteActionState {
    if (CANCELLED_STATUSES.includes(status)) return 'CANCELADA';
    if (DONE_STATUSES.includes(status)) return 'ENCERRADA';
    if (status === ActionStatus.NOT_STARTED || status === ActionStatus.DRAFT) return 'NAO_INICIADA';
    return 'EM_ANDAMENTO';
  }

  private summarize(rows: MinuteAction[]) {
    const open = rows.filter((r) => r.state === 'EM_ANDAMENTO' || r.state === 'NAO_INICIADA');
    return {
      total: rows.length,
      closed: rows.filter((r) => r.state === 'ENCERRADA').length,
      inProgress: rows.filter((r) => r.state === 'EM_ANDAMENTO').length,
      notStarted: rows.filter((r) => r.state === 'NAO_INICIADA').length,
      cancelled: rows.filter((r) => r.state === 'CANCELADA').length,
      overdue: rows.filter((r) => r.overdue).length,
      avgProgress: open.length ? round(open.reduce((sum, r) => sum + r.progress, 0) / open.length) : 0,
    };
  }

  /** Área → Setor → Responsável, na ordem em que a ata é conduzida. */
  private groupByArea(rows: MinuteAction[]) {
    const areas = new Map<string, { id: string; name: string; sectors: Map<string, { id: string; name: string; owners: Map<string, { id: string; name: string; actions: MinuteAction[] }> }> }>();

    for (const row of rows) {
      const areaKey = row.areaMacro?.id ?? 'sem-area';
      const area = areas.get(areaKey) ?? {
        id: areaKey,
        name: row.areaMacro?.name ?? 'Sem área definida',
        sectors: new Map(),
      };
      const sectorKey = row.areaMicro?.id ?? `${areaKey}:geral`;
      const sector = area.sectors.get(sectorKey) ?? {
        id: sectorKey,
        name: row.areaMicro?.name ?? 'Geral',
        owners: new Map(),
      };
      const ownerKey = row.responsible?.id ?? 'sem-responsavel';
      const owner = sector.owners.get(ownerKey) ?? {
        id: ownerKey,
        name: row.responsible?.name ?? 'Sem responsável',
        actions: [],
      };
      owner.actions.push(row);
      sector.owners.set(ownerKey, owner);
      area.sectors.set(sectorKey, sector);
      areas.set(areaKey, area);
    }

    return [...areas.values()]
      .map((area) => ({
        id: area.id,
        name: area.name,
        summary: this.summarize([...area.sectors.values()].flatMap((s) => [...s.owners.values()].flatMap((o) => o.actions))),
        sectors: [...area.sectors.values()]
          .map((sector) => ({
            id: sector.id,
            name: sector.name,
            owners: [...sector.owners.values()]
              .map((owner) => ({ id: owner.id, name: owner.name, actions: owner.actions }))
              .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
          }))
          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }
}

function startOfDay(date: Date | string): number {
  const d = new Date(date);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
