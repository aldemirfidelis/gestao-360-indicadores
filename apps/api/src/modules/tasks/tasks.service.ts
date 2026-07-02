import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationKind, Prisma, UserRoleEnum, WorkspaceTask } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { WorkItemAggregationService } from '../my-day/work-item-aggregation.service';

const BOARD_KEY_PREFIX = 'CENTRAL_TRABALHO';
const ADMIN_ROLES = new Set<UserRoleEnum>([UserRoleEnum.SUPER_ADMIN, UserRoleEnum.COMPANY_ADMIN]);
const VALID_PRIORITIES = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const STICKY_COLORS = ['yellow', 'blue', 'green', 'pink', 'lilac', 'peach'];

const DEFAULT_COLUMNS = [
  { name: 'Ideias', statusKey: 'IDEA', position: 0, color: '#a78bfa', icon: 'Lightbulb', isDoneColumn: false },
  { name: 'A Fazer', statusKey: 'TODO', position: 1, color: '#f59e0b', icon: 'ListTodo', isDoneColumn: false },
  { name: 'Executando', statusKey: 'IN_PROGRESS', position: 2, color: '#3b82f6', icon: 'PlayCircle', isDoneColumn: false },
  { name: 'Revisão', statusKey: 'REVIEW', position: 3, color: '#ec4899', icon: 'ScanSearch', isDoneColumn: false },
  { name: 'Realizado', statusKey: 'DONE', position: 4, color: '#10b981', icon: 'CircleCheckBig', isDoneColumn: true },
] as const;

const SOURCE_LABELS: Record<string, string> = {
  ACTION_PLAN: 'Planos de Ação',
  ACTION_TASK: 'Planos de Ação',
  APPROVAL: 'Aprovações',
  AUDIT: 'Auditorias',
  CHECKLIST: 'Checklists',
  COMMUNICATION: 'Comunicação',
  DOCUMENT: 'Documentos',
  DOCUMENT_EDIT_REQUEST: 'Documentos',
  FORM: 'Formulários',
  INDICATOR: 'Indicadores',
  MEETING: 'Reuniões',
  NONCONFORMITY: 'Não Conformidades',
  PROCESS: 'Processos',
  PROJECT: 'Cronogramas',
  RISK: 'Riscos',
  WORKFLOW_TASK: 'Automações',
};

export interface TaskBoardQuery {
  q?: string;
  scope?: 'all' | 'mine' | 'area';
  kind?: 'all' | 'manual' | 'automatic';
  priority?: string;
  status?: string;
  origin?: string;
  assigneeId?: string;
  areaId?: string;
  projectId?: string;
  overdue?: string;
  linked?: string;
  due?: 'today' | 'week' | 'none';
}

interface MoveTaskInput {
  columnId?: string;
  position?: number;
}

@Injectable()
export class TasksService {
  private readonly automaticRefresh = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly aggregation: WorkItemAggregationService,
  ) {}

  async getBoard(me: AuthPayload, query: TaskBoardQuery) {
    const board = await this.ensureBoard(me.companyId);
    await this.ensureAutomaticTasksFresh(me);
    await this.syncAutomaticTasks(me, board.id, board.columns);

    const scoped = await this.taskScope(me);
    const selectedScope = await this.selectedScope(me, query.scope);
    const where: Prisma.WorkspaceTaskWhereInput = {
      companyId: me.companyId,
      boardId: board.id,
      isArchived: false,
      AND: [scoped, selectedScope, this.queryFilters(query)],
    };
    const tasks = await this.prisma.workspaceTask.findMany({
      where,
      include: {
        _count: { select: { comments: true, attachments: true, checklistItems: true, links: true } },
        checklistItems: { select: { isDone: true } },
      },
      orderBy: [{ column: { position: 'asc' } }, { position: 'asc' }, { createdAt: 'desc' }],
      take: 1000,
    });
    const enriched = await this.enrichTasks(tasks);
    const total = enriched.length;
    const done = enriched.filter((task) => task.status === 'DONE').length;
    const now = Date.now();

    return {
      board,
      tasks: enriched,
      summary: {
        total,
        mine: enriched.filter((task) => task.assigneeId === me.sub).length,
        automatic: enriched.filter((task) => task.isAutomatic).length,
        overdue: enriched.filter((task) => task.status !== 'DONE' && task.dueDate && new Date(task.dueDate).getTime() < now).length,
        executing: enriched.filter((task) => task.status === 'IN_PROGRESS').length,
        review: enriched.filter((task) => task.status === 'REVIEW').length,
        done,
        progress: total ? Math.round((done / total) * 100) : 0,
      },
      filters: query,
      generatedAt: new Date().toISOString(),
    };
  }

  async getContext(me: AuthPayload) {
    const [users, areas, projects] = await Promise.all([
      this.prisma.user.findMany({
        where: { companyId: me.companyId, active: true, deletedAt: null },
        select: { id: true, name: true, avatarUrl: true, jobTitle: true, defaultNodeId: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.orgNode.findMany({
        where: { companyId: me.companyId, active: true, deletedAt: null },
        select: { id: true, name: true, type: true, color: true },
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.project.findMany({
        where: { companyId: me.companyId, deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    return { users, areas, projects };
  }

  async createTask(me: AuthPayload, body: Record<string, unknown>) {
    const title = this.requiredText(body.title, 'Título', 180);
    const board = await this.ensureBoard(me.companyId);
    const column = await this.resolveColumn(board.id, this.optionalText(body.columnId) ?? board.columns.find((item) => item.statusKey === 'TODO')?.id);
    const assigneeId = this.optionalText(body.assigneeId);
    const areaId = this.optionalText(body.areaId);
    const projectId = this.optionalText(body.projectId);
    await this.validateReferences(me.companyId, { assigneeId, areaId, projectId });
    const position = await this.nextPosition(column.id);
    const priority = this.priority(body.priority);
    const task = await this.prisma.workspaceTask.create({
      data: {
        companyId: me.companyId,
        boardId: board.id,
        columnId: column.id,
        title,
        description: this.optionalText(body.description, 10_000),
        status: column.statusKey,
        priority,
        dueDate: this.optionalDate(body.dueDate, 'Prazo'),
        startDate: this.optionalDate(body.startDate, 'Data inicial'),
        assigneeId,
        createdById: me.sub,
        areaId,
        projectId,
        position,
        color: this.stickyColor(body.color, title),
        icon: this.optionalText(body.icon, 40),
        tags: this.stringArray(body.tags, 12, 40),
        isAutomatic: false,
        sourceType: 'MANUAL',
        generatedBy: 'USER',
        activities: {
          create: {
            userId: me.sub,
            action: 'TASK_CREATED',
            toValue: column.name,
            metadata: { automatic: false, priority },
          },
        },
      },
      include: { _count: true, checklistItems: true },
    });
    await this.notifyAssignment(me, task);
    return (await this.enrichTasks([task]))[0];
  }

  async getTask(me: AuthPayload, id: string) {
    await this.assertTaskAccess(me, id);
    const task = await this.prisma.workspaceTask.findUnique({
      where: { id },
      include: {
        comments: { orderBy: { createdAt: 'desc' } },
        attachments: { orderBy: { createdAt: 'desc' } },
        checklistItems: { orderBy: { position: 'asc' } },
        activities: { orderBy: { createdAt: 'desc' }, take: 200 },
        links: { orderBy: { createdAt: 'asc' } },
        column: true,
        board: { select: { id: true, name: true, columns: { orderBy: { position: 'asc' } } } },
        _count: true,
      },
    });
    if (!task) throw new NotFoundException('Tarefa não encontrada.');
    const [enriched] = await this.enrichTasks([task]);
    const peopleIds = new Set<string>();
    task.comments.forEach((item) => peopleIds.add(item.userId));
    task.activities.forEach((item) => {
      if (item.userId) peopleIds.add(item.userId);
    });
    const people = await this.peopleMap([...peopleIds]);
    return {
      ...enriched,
      comments: task.comments.map((item) => ({ ...item, user: people.get(item.userId) ?? null })),
      activities: task.activities.map((item) => ({ ...item, user: item.userId ? people.get(item.userId) ?? null : null })),
    };
  }

  async updateTask(me: AuthPayload, id: string, body: Record<string, unknown>) {
    const current = await this.assertTaskAccess(me, id, true);
    const data: Prisma.WorkspaceTaskUpdateInput = {};
    const changes: Array<{ field: string; from: string | null; to: string | null }> = [];

    if (body.title !== undefined) {
      const value = this.requiredText(body.title, 'Título', 180);
      data.title = value;
      changes.push({ field: 'title', from: current.title, to: value });
    }
    if (body.description !== undefined) data.description = this.optionalText(body.description, 10_000);
    if (body.priority !== undefined) {
      const value = this.priority(body.priority);
      data.priority = value;
      changes.push({ field: 'priority', from: current.priority, to: value });
    }
    if (body.dueDate !== undefined) {
      const value = this.optionalDate(body.dueDate, 'Prazo');
      data.dueDate = value;
      changes.push({ field: 'dueDate', from: current.dueDate?.toISOString() ?? null, to: value?.toISOString() ?? null });
    }
    if (body.startDate !== undefined) data.startDate = this.optionalDate(body.startDate, 'Data inicial');
    if (body.assigneeId !== undefined) {
      const value = this.optionalText(body.assigneeId);
      await this.validateReferences(me.companyId, { assigneeId: value });
      data.assigneeId = value;
      changes.push({ field: 'assignee', from: current.assigneeId, to: value });
    }
    if (body.areaId !== undefined) {
      const value = this.optionalText(body.areaId);
      await this.validateReferences(me.companyId, { areaId: value });
      data.areaId = value;
    }
    if (body.projectId !== undefined) {
      const value = this.optionalText(body.projectId);
      await this.validateReferences(me.companyId, { projectId: value });
      data.projectId = value;
    }
    if (body.tags !== undefined) data.tags = this.stringArray(body.tags, 12, 40);
    if (body.color !== undefined) data.color = this.stickyColor(body.color, current.title);

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.workspaceTask.update({ where: { id }, data });
      if (changes.length) {
        await tx.taskActivity.createMany({
          data: changes.map((change) => ({
            taskId: id,
            userId: me.sub,
            action: `TASK_${change.field.toUpperCase()}_CHANGED`,
            fromValue: change.from,
            toValue: change.to,
          })),
        });
      }
      return row;
    });
    if (body.assigneeId !== undefined && updated.assigneeId !== current.assigneeId) await this.notifyAssignment(me, updated);
    return this.getTask(me, id);
  }

  async moveTask(me: AuthPayload, id: string, body: MoveTaskInput) {
    const current = await this.assertTaskAccess(me, id, true);
    const column = await this.resolveColumn(current.boardId, body.columnId);
    const previous = await this.prisma.taskBoardColumn.findUnique({ where: { id: current.columnId } });
    if (!previous) throw new NotFoundException('Coluna atual não encontrada.');
    const now = new Date();
    const position = Number.isFinite(body.position) ? Number(body.position) : await this.nextPosition(column.id);
    await this.prisma.$transaction([
      this.prisma.workspaceTask.update({
        where: { id },
        data: {
          columnId: column.id,
          status: column.statusKey,
          position,
          startDate: column.statusKey === 'IN_PROGRESS' && !current.startDate ? now : undefined,
          completedAt: column.isDoneColumn ? current.completedAt ?? now : null,
        },
      }),
      this.prisma.taskActivity.create({
        data: {
          taskId: id,
          userId: me.sub,
          action: column.isDoneColumn ? 'TASK_COMPLETED' : current.completedAt ? 'TASK_REOPENED' : 'TASK_MOVED',
          fromValue: previous.name,
          toValue: column.name,
          metadata: { fromStatus: previous.statusKey, toStatus: column.statusKey },
        },
      }),
    ]);
    if (current.isAutomatic) await this.propagateSourceStatus(current, column.statusKey, me);
    if (column.isDoneColumn && current.createdById && current.createdById !== me.sub) {
      await this.createNotification(me.companyId, current.createdById, `Tarefa concluída: ${current.title}`, `${me.name} marcou a tarefa como realizada.`, `/tarefas?task=${id}`);
    }
    return this.getTask(me, id);
  }

  async archiveTask(me: AuthPayload, id: string) {
    const current = await this.assertTaskAccess(me, id, true);
    await this.prisma.$transaction([
      this.prisma.workspaceTask.update({ where: { id }, data: { isArchived: true } }),
      this.prisma.taskActivity.create({
        data: { taskId: id, userId: me.sub, action: 'TASK_ARCHIVED', fromValue: current.status, toValue: 'ARCHIVED' },
      }),
    ]);
    return { ok: true };
  }

  async addComment(me: AuthPayload, id: string, body: { content?: string; mentions?: string[] }) {
    const task = await this.assertTaskAccess(me, id, true);
    const content = this.requiredText(body.content, 'Comentário', 4_000);
    const mentions = [...new Set((body.mentions ?? []).filter((value) => typeof value === 'string'))].slice(0, 20);
    if (mentions.length) {
      const valid = await this.prisma.user.findMany({
        where: { companyId: me.companyId, id: { in: mentions }, active: true },
        select: { id: true },
      });
      mentions.splice(0, mentions.length, ...valid.map((item) => item.id));
    }
    const comment = await this.prisma.$transaction(async (tx) => {
      const row = await tx.taskComment.create({ data: { taskId: id, userId: me.sub, content, mentions } });
      await tx.taskActivity.create({
        data: { taskId: id, userId: me.sub, action: 'COMMENT_ADDED', metadata: { commentId: row.id, mentions } },
      });
      return row;
    });
    await Promise.all(
      mentions.filter((userId) => userId !== me.sub).map((userId) =>
        this.createNotification(me.companyId, userId, `${me.name} mencionou você em uma tarefa`, task.title, `/tarefas?task=${id}`, NotificationKind.MENTION),
      ),
    );
    return { ...comment, user: { id: me.sub, name: me.name } };
  }

  async addChecklistItem(me: AuthPayload, id: string, body: { title?: string; assigneeId?: string | null }) {
    await this.assertTaskAccess(me, id, true);
    const title = this.requiredText(body.title, 'Item do checklist', 240);
    const assigneeId = this.optionalText(body.assigneeId);
    await this.validateReferences(me.companyId, { assigneeId });
    const aggregate = await this.prisma.taskChecklistItem.aggregate({ where: { taskId: id }, _max: { position: true } });
    const item = await this.prisma.taskChecklistItem.create({
      data: { taskId: id, title, assigneeId, position: (aggregate._max.position ?? -1) + 1 },
    });
    await this.prisma.taskActivity.create({
      data: { taskId: id, userId: me.sub, action: 'CHECKLIST_ITEM_ADDED', toValue: title, metadata: { checklistItemId: item.id } },
    });
    return item;
  }

  async updateChecklistItem(
    me: AuthPayload,
    id: string,
    itemId: string,
    body: { title?: string; isDone?: boolean; assigneeId?: string | null },
  ) {
    await this.assertTaskAccess(me, id, true);
    const current = await this.prisma.taskChecklistItem.findFirst({ where: { id: itemId, taskId: id } });
    if (!current) throw new NotFoundException('Item do checklist não encontrado.');
    const assigneeId = body.assigneeId === undefined ? undefined : this.optionalText(body.assigneeId);
    if (assigneeId !== undefined) await this.validateReferences(me.companyId, { assigneeId });
    const item = await this.prisma.taskChecklistItem.update({
      where: { id: itemId },
      data: {
        title: body.title === undefined ? undefined : this.requiredText(body.title, 'Item do checklist', 240),
        isDone: typeof body.isDone === 'boolean' ? body.isDone : undefined,
        assigneeId,
      },
    });
    if (body.isDone !== undefined && body.isDone !== current.isDone) {
      await this.prisma.taskActivity.create({
        data: {
          taskId: id,
          userId: me.sub,
          action: body.isDone ? 'CHECKLIST_ITEM_COMPLETED' : 'CHECKLIST_ITEM_REOPENED',
          fromValue: current.title,
          toValue: item.title,
          metadata: { checklistItemId: item.id },
        },
      });
    }
    return item;
  }

  async removeChecklistItem(me: AuthPayload, id: string, itemId: string) {
    await this.assertTaskAccess(me, id, true);
    const item = await this.prisma.taskChecklistItem.findFirst({ where: { id: itemId, taskId: id } });
    if (!item) throw new NotFoundException('Item do checklist não encontrado.');
    await this.prisma.$transaction([
      this.prisma.taskChecklistItem.delete({ where: { id: itemId } }),
      this.prisma.taskActivity.create({
        data: { taskId: id, userId: me.sub, action: 'CHECKLIST_ITEM_REMOVED', fromValue: item.title },
      }),
    ]);
    return { ok: true };
  }

  async addAttachment(me: AuthPayload, id: string, body: Record<string, unknown>) {
    await this.assertTaskAccess(me, id, true);
    const fileName = this.requiredText(body.fileName, 'Nome do anexo', 240);
    const fileUrl = this.requiredText(body.fileUrl, 'URL do anexo', 2_000);
    if (!fileUrl.startsWith('/') && !/^https?:\/\//i.test(fileUrl)) throw new BadRequestException('Informe uma URL de anexo válida.');
    const attachment = await this.prisma.taskAttachment.create({
      data: {
        taskId: id,
        fileName,
        fileUrl,
        fileType: this.optionalText(body.fileType, 120),
        fileSize: typeof body.fileSize === 'number' && body.fileSize >= 0 ? Math.floor(body.fileSize) : null,
        uploadedById: me.sub,
      },
    });
    await this.prisma.taskActivity.create({
      data: { taskId: id, userId: me.sub, action: 'ATTACHMENT_ADDED', toValue: fileName, metadata: { attachmentId: attachment.id } },
    });
    return attachment;
  }

  async addLink(me: AuthPayload, id: string, body: Record<string, unknown>) {
    await this.assertTaskAccess(me, id, true);
    const url = this.optionalText(body.url, 2_000);
    if (url && !url.startsWith('/') && !/^https?:\/\//i.test(url)) throw new BadRequestException('Informe uma rota ou URL válida.');
    const data = {
      taskId: id,
      entityType: this.requiredText(body.entityType, 'Tipo do vínculo', 80).toUpperCase(),
      entityId: this.requiredText(body.entityId, 'Registro vinculado', 180),
      entityLabel: this.requiredText(body.entityLabel, 'Nome do registro', 240),
      moduleName: this.requiredText(body.moduleName, 'Módulo', 120),
      url,
    };
    const link = await this.prisma.taskLink.upsert({
      where: { taskId_entityType_entityId: { taskId: id, entityType: data.entityType, entityId: data.entityId } },
      create: data,
      update: { entityLabel: data.entityLabel, moduleName: data.moduleName, url: data.url },
    });
    await this.prisma.taskActivity.create({
      data: { taskId: id, userId: me.sub, action: 'LINK_CREATED', toValue: data.entityLabel, metadata: { linkId: link.id } },
    });
    return link;
  }

  async removeLink(me: AuthPayload, id: string, linkId: string) {
    const task = await this.assertTaskAccess(me, id, true);
    const link = await this.prisma.taskLink.findFirst({ where: { id: linkId, taskId: id } });
    if (!link) throw new NotFoundException('Vínculo não encontrado.');
    if (task.isAutomatic && link.entityType === task.sourceType && link.entityId === task.sourceEntityId) {
      throw new BadRequestException('O vínculo de origem de uma tarefa automática não pode ser removido.');
    }
    await this.prisma.$transaction([
      this.prisma.taskLink.delete({ where: { id: linkId } }),
      this.prisma.taskActivity.create({
        data: { taskId: id, userId: me.sub, action: 'LINK_REMOVED', fromValue: link.entityLabel, metadata: { linkId } },
      }),
    ]);
    return { ok: true };
  }

  async updateWiki(me: AuthPayload, content?: string) {
    const board = await this.ensureBoard(me.companyId);
    return this.prisma.taskBoard.update({
      where: { id: board.id },
      data: { wikiContent: (content ?? '').trim().slice(0, 50_000) || null },
      select: { id: true, wikiContent: true, updatedAt: true },
    });
  }

  private async ensureBoard(companyId: string) {
    const key = `${BOARD_KEY_PREFIX}:${companyId}`;
    return this.prisma.taskBoard.upsert({
      where: { key },
      update: {},
      create: {
        key,
        companyId,
        name: 'Central de Trabalho da Equipe',
        description: 'Todas as tarefas manuais e automáticas da empresa em um quadro visual.',
        columns: { create: DEFAULT_COLUMNS.map((column) => ({ ...column })) },
      },
      include: { columns: { orderBy: { position: 'asc' } } },
    });
  }

  private async ensureAutomaticTasksFresh(me: AuthPayload) {
    const key = `${me.companyId}:${me.sub}`;
    const last = this.automaticRefresh.get(key) ?? 0;
    if (Date.now() - last < 30_000) return;
    await this.aggregation.rebuildForUser(me);
    this.automaticRefresh.set(key, Date.now());
  }

  private async syncAutomaticTasks(
    me: AuthPayload,
    boardId: string,
    columns: Array<{ id: string; statusKey: string; isDoneColumn: boolean }>,
  ) {
    const admin = ADMIN_ROLES.has(me.role);
    const areaIds = admin ? [] : await this.userAreaIds(me);
    const visibility: Prisma.WorkItemIndexWhereInput = admin
      ? {}
      : {
          OR: [
            { assignedUserId: me.sub },
            ...(areaIds.length ? [{ assignedUserId: null, orgNodeId: { in: areaIds } }] : []),
          ],
        };
    const workItems = await this.prisma.workItemIndex.findMany({
      where: {
        companyId: me.companyId,
        status: { not: 'ARCHIVED' },
        sourceEntityType: { not: 'NOTIFICATION' },
        ...visibility,
      },
      orderBy: [{ priorityScore: 'desc' }, { dueAt: 'asc' }],
      take: 1000,
    });
    if (!workItems.length) return;
    const byStatus = new Map(columns.map((column) => [column.statusKey, column]));
    const todo = byStatus.get('TODO');
    if (!todo) throw new BadRequestException('O quadro não possui a coluna A Fazer.');

    for (let index = 0; index < workItems.length; index += 1) {
      const item = workItems[index];
      const mappedStatus = this.mapWorkItemStatus(item.status, item.itemType);
      const targetColumn = byStatus.get(mappedStatus) ?? todo;
      const sourceType = this.normalizeSourceType(item.sourceEntityType, item.itemType);
      const sourceModule = SOURCE_LABELS[sourceType] ?? this.humanize(item.sourceModule || sourceType);
      const sourceUrl = this.sourceUrl(item.availableActions);
      const sourceKey = `WORK_ITEM:${item.dedupeKey}`;
      const forcedDone = mappedStatus === 'DONE';
      const task = await this.prisma.workspaceTask.upsert({
        where: { sourceKey },
        create: {
          companyId: me.companyId,
          boardId,
          columnId: targetColumn.id,
          title: item.title,
          description: item.summary,
          status: targetColumn.statusKey,
          priority: item.priority === 'INFO' ? 'LOW' : item.priority,
          dueDate: item.dueAt,
          startDate: mappedStatus === 'IN_PROGRESS' ? item.sourceUpdatedAt ?? new Date() : null,
          completedAt: forcedDone ? item.completedAt ?? new Date() : null,
          assigneeId: item.assignedUserId,
          areaId: item.orgNodeId,
          position: index * 1000,
          color: this.colorForSource(sourceType),
          tags: [sourceModule],
          isAutomatic: true,
          sourceKey,
          sourceType,
          sourceModule,
          sourceEntityId: item.sourceEntityId,
          sourceEntityLabel: item.title,
          sourceUrl,
          automationRuleId: item.sourceEntityType,
          generatedBy: 'SYSTEM',
          generatedAt: item.sourceCreatedAt ?? item.createdAt,
          activities: {
            create: {
              action: 'TASK_AUTOMATICALLY_CREATED',
              toValue: targetColumn.statusKey,
              metadata: { sourceType, sourceModule, workItemId: item.id },
            },
          },
        },
        update: {
          title: item.title,
          description: item.summary,
          dueDate: item.dueAt,
          priority: item.priority === 'INFO' ? 'LOW' : item.priority,
          assigneeId: item.assignedUserId,
          areaId: item.orgNodeId,
          sourceModule,
          sourceEntityLabel: item.title,
          sourceUrl,
          automationRuleId: item.sourceEntityType,
          ...(forcedDone
            ? { columnId: targetColumn.id, status: 'DONE', completedAt: item.completedAt ?? new Date() }
            : {}),
        },
      });
      await this.prisma.taskLink.upsert({
        where: { taskId_entityType_entityId: { taskId: task.id, entityType: sourceType, entityId: item.sourceEntityId } },
        create: {
          taskId: task.id,
          entityType: sourceType,
          entityId: item.sourceEntityId,
          entityLabel: item.title,
          moduleName: sourceModule,
          url: sourceUrl,
        },
        update: { entityLabel: item.title, moduleName: sourceModule, url: sourceUrl },
      });
    }
  }

  private queryFilters(query: TaskBoardQuery): Prisma.WorkspaceTaskWhereInput {
    const filters: Prisma.WorkspaceTaskWhereInput[] = [];
    if (query.q?.trim()) {
      const q = query.q.trim();
      filters.push({
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { sourceEntityLabel: { contains: q, mode: 'insensitive' } },
          { sourceModule: { contains: q, mode: 'insensitive' } },
        ],
      });
    }
    if (query.kind === 'manual') filters.push({ isAutomatic: false });
    if (query.kind === 'automatic') filters.push({ isAutomatic: true });
    if (query.priority && VALID_PRIORITIES.has(query.priority.toUpperCase())) filters.push({ priority: query.priority.toUpperCase() });
    if (query.status) filters.push({ status: query.status.toUpperCase() });
    if (query.origin) {
      if (query.origin.toUpperCase() === 'MANUAL') filters.push({ isAutomatic: false });
      else filters.push({ OR: [{ sourceType: query.origin.toUpperCase() }, { sourceModule: { equals: query.origin, mode: 'insensitive' } }] });
    }
    if (query.assigneeId === '__none__') filters.push({ assigneeId: null });
    else if (query.assigneeId) filters.push({ assigneeId: query.assigneeId });
    if (query.areaId) filters.push({ areaId: query.areaId });
    if (query.projectId) filters.push({ projectId: query.projectId });
    if (query.overdue === 'true') filters.push({ status: { not: 'DONE' }, dueDate: { lt: new Date() } });
    if (query.due === 'none') filters.push({ dueDate: null });
    if (query.due === 'today') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      filters.push({ dueDate: { gte: start, lt: end } });
    }
    if (query.due === 'week') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      filters.push({ dueDate: { gte: start, lt: end } });
    }
    if (query.linked === 'true') filters.push({ links: { some: {} } });
    if (query.linked === 'false') filters.push({ links: { none: {} } });
    return filters.length ? { AND: filters } : {};
  }

  private async taskScope(me: AuthPayload): Promise<Prisma.WorkspaceTaskWhereInput> {
    if (ADMIN_ROLES.has(me.role)) return {};
    const areas = await this.userAreaIds(me);
    return {
      OR: [
        { assigneeId: me.sub },
        { createdById: me.sub },
        ...(areas.length ? [{ areaId: { in: areas } }] : []),
      ],
    };
  }

  private async selectedScope(me: AuthPayload, scope?: TaskBoardQuery['scope']): Promise<Prisma.WorkspaceTaskWhereInput> {
    if (scope === 'mine') return { assigneeId: me.sub };
    if (scope === 'area') {
      const areas = await this.userAreaIds(me);
      return areas.length ? { areaId: { in: areas } } : { id: '__no_accessible_area__' };
    }
    return {};
  }

  private async assertTaskAccess(me: AuthPayload, id: string, write = false): Promise<WorkspaceTask> {
    const task = await this.prisma.workspaceTask.findFirst({ where: { id, companyId: me.companyId, isArchived: false } });
    if (!task) throw new NotFoundException('Tarefa não encontrada.');
    if (ADMIN_ROLES.has(me.role)) return task;
    const areas = await this.userAreaIds(me);
    const allowed = task.assigneeId === me.sub || task.createdById === me.sub || Boolean(task.areaId && areas.includes(task.areaId));
    if (!allowed) throw new ForbiddenException(write ? 'Você não pode alterar esta tarefa.' : 'Você não pode visualizar esta tarefa.');
    return task;
  }

  private async userAreaIds(me: AuthPayload) {
    const [user, assignments] = await Promise.all([
      this.prisma.user.findFirst({ where: { id: me.sub, companyId: me.companyId }, select: { defaultNodeId: true } }),
      this.prisma.userAreaAssignment.findMany({
        where: {
          userId: me.sub,
          companyId: me.companyId,
          OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }],
        },
        select: { orgNodeId: true },
      }),
    ]);
    return [...new Set([user?.defaultNodeId, ...assignments.map((item) => item.orgNodeId)].filter((value): value is string => Boolean(value)))];
  }

  private async resolveColumn(boardId: string, columnId?: string | null) {
    if (!columnId) throw new BadRequestException('Selecione uma coluna.');
    const column = await this.prisma.taskBoardColumn.findFirst({ where: { id: columnId, boardId } });
    if (!column) throw new BadRequestException('Coluna inválida para este quadro.');
    return column;
  }

  private async nextPosition(columnId: string) {
    const aggregate = await this.prisma.workspaceTask.aggregate({
      where: { columnId, isArchived: false },
      _max: { position: true },
    });
    return (aggregate._max.position ?? 0) + 1000;
  }

  private async validateReferences(
    companyId: string,
    refs: { assigneeId?: string | null; areaId?: string | null; projectId?: string | null },
  ) {
    const [user, area, project] = await Promise.all([
      refs.assigneeId
        ? this.prisma.user.findFirst({ where: { id: refs.assigneeId, companyId, active: true, deletedAt: null }, select: { id: true } })
        : Promise.resolve(null),
      refs.areaId
        ? this.prisma.orgNode.findFirst({ where: { id: refs.areaId, companyId, active: true, deletedAt: null }, select: { id: true } })
        : Promise.resolve(null),
      refs.projectId
        ? this.prisma.project.findFirst({ where: { id: refs.projectId, companyId, deletedAt: null }, select: { id: true } })
        : Promise.resolve(null),
    ]);
    if (refs.assigneeId && !user) throw new BadRequestException('Responsável inválido para esta empresa.');
    if (refs.areaId && !area) throw new BadRequestException('Área inválida para esta empresa.');
    if (refs.projectId && !project) throw new BadRequestException('Projeto inválido para esta empresa.');
  }

  private async enrichTasks<T extends { assigneeId: string | null; createdById: string | null; areaId: string | null; projectId: string | null }>(tasks: T[]) {
    const userIds = [...new Set(tasks.flatMap((task) => [task.assigneeId, task.createdById]).filter((value): value is string => Boolean(value)))];
    const areaIds = [...new Set(tasks.map((task) => task.areaId).filter((value): value is string => Boolean(value)))];
    const projectIds = [...new Set(tasks.map((task) => task.projectId).filter((value): value is string => Boolean(value)))];
    const [people, areas, projects] = await Promise.all([
      this.peopleMap(userIds),
      areaIds.length
        ? this.prisma.orgNode.findMany({ where: { id: { in: areaIds } }, select: { id: true, name: true, color: true } })
        : Promise.resolve([]),
      projectIds.length
        ? this.prisma.project.findMany({ where: { id: { in: projectIds } }, select: { id: true, name: true } })
        : Promise.resolve([]),
    ]);
    const areaMap = new Map(areas.map((item) => [item.id, item]));
    const projectMap = new Map(projects.map((item) => [item.id, item]));
    return tasks.map((task) => ({
      ...task,
      assignee: task.assigneeId ? people.get(task.assigneeId) ?? null : null,
      createdBy: task.createdById ? people.get(task.createdById) ?? null : null,
      area: task.areaId ? areaMap.get(task.areaId) ?? null : null,
      project: task.projectId ? projectMap.get(task.projectId) ?? null : null,
    }));
  }

  private async peopleMap(ids: string[]) {
    if (!ids.length) return new Map<string, { id: string; name: string; avatarUrl: string | null; jobTitle: string | null }>();
    const people = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, avatarUrl: true, jobTitle: true },
    });
    return new Map(people.map((item) => [item.id, item]));
  }

  private async notifyAssignment(me: AuthPayload, task: Pick<WorkspaceTask, 'id' | 'title' | 'assigneeId'>) {
    if (!task.assigneeId || task.assigneeId === me.sub) return;
    await this.createNotification(
      me.companyId,
      task.assigneeId,
      `Nova tarefa atribuída: ${task.title}`,
      `${me.name} atribuiu uma tarefa para você.`,
      `/tarefas?task=${task.id}`,
    );
  }

  private async createNotification(
    companyId: string,
    userId: string,
    title: string,
    body: string,
    link: string,
    kind: NotificationKind = NotificationKind.ACTION_DUE_SOON,
  ) {
    await this.prisma.notification.create({ data: { companyId, userId, title, body, link, kind } });
  }

  /** Propaga somente transições inequívocas; auditorias, riscos e documentos exigem fluxos próprios. */
  private async propagateSourceStatus(task: WorkspaceTask, status: string, me: AuthPayload) {
    if (!task.sourceEntityId) return;
    if (task.automationRuleId === 'ACTION_TASK' && status === 'DONE') {
      await this.prisma.actionTask.updateMany({
        where: { id: task.sourceEntityId, action: { companyId: me.companyId } },
        data: { done: true, completionNote: `Concluída pela Central de Trabalho por ${me.name}.` },
      });
      return;
    }
    if (task.automationRuleId === 'WORKFLOW_TASK' && (status === 'IN_PROGRESS' || status === 'DONE')) {
      await this.prisma.workflowTask.updateMany({
        where: { id: task.sourceEntityId, companyId: me.companyId },
        data: status === 'DONE' ? { status: 'DONE', completedAt: new Date() } : { status: 'IN_PROGRESS' },
      });
      return;
    }
    if (task.automationRuleId === 'PROJECT_TASK' && status === 'DONE') {
      await this.prisma.projectTask.updateMany({
        where: { id: task.sourceEntityId, project: { companyId: me.companyId } },
        data: { progress: 100 },
      });
    }
  }

  private mapWorkItemStatus(status: string, itemType: string) {
    const normalized = status.toUpperCase();
    if (['APPROVAL', 'DOCUMENT_EDIT_APPROVAL'].includes(itemType)) return 'REVIEW';
    if (['DONE', 'COMPLETED', 'CLOSED', 'APPROVED', 'REVIEWED'].includes(normalized)) return 'DONE';
    if (['IN_PROGRESS', 'UNDER_ANALYSIS', 'ACTION', 'MITIGATING', 'IN_TREATMENT'].includes(normalized)) return 'IN_PROGRESS';
    if (
      normalized === 'WAITING'
      || normalized === 'BLOCKED'
      || normalized === 'VERIFICATION'
      || normalized === 'LEAD_REVIEW'
      || normalized === 'FOLLOW_UP'
      || normalized === 'SUBMITTED'
      || normalized.startsWith('WAITING_')
    ) return 'REVIEW';
    return 'TODO';
  }

  private normalizeSourceType(sourceEntityType: string, itemType: string) {
    const value = (sourceEntityType || itemType || 'AUTOMATION').toUpperCase();
    if (value.includes('INDICATOR')) return 'INDICATOR';
    if (value.includes('NONCONFORM') || value === 'NC') return 'NONCONFORMITY';
    if (value.includes('ACTION')) return 'ACTION_PLAN';
    if (value.includes('AUDIT')) return 'AUDIT';
    if (value.includes('DOCUMENT')) return 'DOCUMENT';
    if (value.includes('FORM')) return 'FORM';
    if (value.includes('CHECKLIST')) return 'CHECKLIST';
    if (value.includes('RISK')) return 'RISK';
    if (value.includes('MEETING')) return 'MEETING';
    if (value.includes('PROCESS')) return 'PROCESS';
    if (value.includes('PROJECT') || value.includes('SCHEDULE')) return 'PROJECT';
    if (value.includes('APPROVAL')) return 'APPROVAL';
    if (value.includes('WORKFLOW')) return 'WORKFLOW_TASK';
    return value.replace(/[^A-Z0-9_]/g, '_');
  }

  private sourceUrl(value: Prisma.JsonValue | null) {
    if (!Array.isArray(value)) return null;
    const action = value.find(
      (entry): entry is Prisma.JsonObject =>
        Boolean(entry && typeof entry === 'object' && !Array.isArray(entry) && entry.key === 'open' && typeof entry.href === 'string'),
    );
    return action && typeof action.href === 'string' ? action.href : null;
  }

  private humanize(value: string) {
    return value
      .replace(/[_-]+/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  private colorForSource(sourceType: string) {
    const index = [...sourceType].reduce((total, char) => total + char.charCodeAt(0), 0) % STICKY_COLORS.length;
    return STICKY_COLORS[index];
  }

  private stickyColor(value: unknown, seed: string) {
    const color = this.optionalText(value, 20);
    return color && STICKY_COLORS.includes(color) ? color : this.colorForSource(seed);
  }

  private priority(value: unknown) {
    const priority = this.optionalText(value)?.toUpperCase() ?? 'MEDIUM';
    if (!VALID_PRIORITIES.has(priority)) throw new BadRequestException('Prioridade inválida.');
    return priority;
  }

  private requiredText(value: unknown, label: string, max: number) {
    if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(`${label} é obrigatório.`);
    if (value.trim().length > max) throw new BadRequestException(`${label} deve ter no máximo ${max} caracteres.`);
    return value.trim();
  }

  private optionalText(value: unknown, max = 500): string | null {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value !== 'string') throw new BadRequestException('Valor de texto inválido.');
    return value.trim().slice(0, max) || null;
  }

  private optionalDate(value: unknown, label: string): Date | null {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value !== 'string' && !(value instanceof Date)) throw new BadRequestException(`${label} inválido.`);
    const normalized = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? `${value}T12:00:00.000Z`
      : value;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) throw new BadRequestException(`${label} inválido.`);
    return date;
  }

  private stringArray(value: unknown, maxItems: number, maxLength: number) {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) throw new BadRequestException('Lista inválida.');
    return [...new Set(value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean))]
      .slice(0, maxItems)
      .map((item) => item.slice(0, maxLength));
  }
}
