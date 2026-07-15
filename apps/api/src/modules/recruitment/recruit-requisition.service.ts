import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditWriterService } from '../../common/audit/audit-writer.service';
import { AuthPayload } from '../auth/auth.types';
import {
  approvalOutcome,
  canTransition,
  checkApprovalSegregation,
  evaluateVacancyGate,
  nextPendingApproval,
  type ApprovalStep,
  type RequisitionStatus,
} from './recruit-requisition.logic';

const MODULE = 'recruitment';
const GATE_KINDS = ['POSITION', 'HEADCOUNT', 'BUDGET'];

/**
 * Requisição de vaga (F1). Reusa CompensationPosition/Budget (quadro/orçamento),
 * OrgJob (cargo) e o organograma. Travas FLEXÍVEIS: posição opcional, exceção
 * de quadro/orçamento aprovável e auditada. Segregação: solicitante ≠ aprovador.
 */
@Injectable()
export class RecruitRequisitionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriterService,
  ) {}

  async list(me: AuthPayload, filters: { status?: string; orgNodeId?: string } = {}) {
    return this.prisma.recruitRequisition.findMany({
      where: {
        companyId: me.companyId,
        deletedAt: null,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.orgNodeId ? { orgNodeId: filters.orgNodeId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { _count: { select: { openings: true, approvals: true } } },
    });
  }

  async get(me: AuthPayload, id: string) {
    const req = await this.prisma.recruitRequisition.findFirst({
      where: { id, companyId: me.companyId, deletedAt: null },
      include: {
        openings: true,
        approvals: { orderBy: { order: 'asc' } },
        snapshots: { orderBy: { version: 'desc' }, take: 1 },
      },
    });
    if (!req) throw new NotFoundException('Requisição não encontrada.');
    return req;
  }

  /** Cria a requisição a partir de uma posição (opcional) ou "aumento de quadro". */
  async create(me: AuthPayload, body: any = {}) {
    const orgJobId = await this.resolveJob(me.companyId, body);
    const positionId = await this.resolvePosition(me.companyId, body?.positionId);
    const openingsRequested = Math.max(1, Number(body?.openingsRequested ?? 1) || 1);
    const code = await this.nextCode(me.companyId);

    const created = await this.prisma.$transaction(async (tx) => {
      const req = await tx.recruitRequisition.create({
        data: {
          companyId: me.companyId,
          code,
          status: 'DRAFT',
          branchId: text(body?.branchId),
          orgNodeId: text(body?.orgNodeId),
          costCenter: text(body?.costCenter),
          positionId,
          orgJobId,
          jobCatalogId: text(body?.jobCatalogId),
          openingsRequested,
          requesterId: text(body?.requesterId) ?? me.sub,
          reason: text(body?.reason),
          vacancyType: String(body?.vacancyType ?? 'AUMENTO'),
          replacedEmployeeId: text(body?.replacedEmployeeId),
          desiredAdmissionAt: body?.desiredAdmissionAt ? new Date(body.desiredAdmissionAt) : null,
          priority: String(body?.priority ?? 'NORMAL'),
          criticality: text(body?.criticality),
          workMode: text(body?.workMode),
          city: text(body?.city),
          location: text(body?.location),
          shift: text(body?.shift),
          schedule: text(body?.schedule),
          contractType: text(body?.contractType),
          salaryMin: body?.salaryMin != null ? new Prisma.Decimal(body.salaryMin) : null,
          salaryMax: body?.salaryMax != null ? new Prisma.Decimal(body.salaryMax) : null,
          monthlyBudgetCents: body?.monthlyBudgetCents != null ? Math.round(Number(body.monthlyBudgetCents)) : null,
          confidential: Boolean(body?.confidential),
          slaDays: body?.slaDays != null ? Math.round(Number(body.slaDays)) : null,
          recruitmentScope: String(body?.recruitmentScope ?? 'EXTERNAL'),
          allowsReferral: body?.allowsReferral ?? true,
          allowsFormerEmployees: body?.allowsFormerEmployees ?? true,
          allowsAgency: Boolean(body?.allowsAgency),
          recruiterId: text(body?.recruiterId),
          details: (body?.details ?? undefined) as Prisma.InputJsonValue | undefined,
          notes: text(body?.notes),
          createdById: me.sub,
        },
      });
      // Aberturas (uma por vaga solicitada).
      await tx.recruitRequisitionOpening.createMany({
        data: Array.from({ length: openingsRequested }, () => ({ companyId: me.companyId, requisitionId: req.id, positionId })),
      });
      // Snapshot versionado da descrição/requisitos do cargo.
      await tx.recruitRequisitionSnapshot.create({
        data: { companyId: me.companyId, requisitionId: req.id, version: 1, jobData: await this.buildJobSnapshot(me.companyId, orgJobId, body), createdById: me.sub },
      });
      // Workflow de aprovação (default configurável).
      const steps = this.buildApprovalSteps(body);
      if (steps.length) {
        await tx.recruitRequisitionApproval.createMany({
          data: steps.map((s) => ({ companyId: me.companyId, requisitionId: req.id, order: s.order, role: s.role, approverId: s.approverId ?? null })),
        });
      }
      return req;
    });

    await this.audit.record(me, { module: MODULE, entity: 'RecruitRequisition', entityId: created.id, action: 'CREATE', message: `Requisição ${code} criada`, after: { code, orgJobId, positionId, openingsRequested } });
    return this.get(me, created.id);
  }

  /** Envia para aprovação e RESERVA quadro/orçamento (provisório). */
  async submit(me: AuthPayload, id: string) {
    const req = await this.requisitionOf(me.companyId, id);
    this.assertTransition(req.status as RequisitionStatus, 'SUBMITTED');
    await this.prisma.recruitRequisition.update({
      where: { id },
      data: { status: 'SUBMITTED', reservedHeadcount: req.openingsRequested, reservedBudgetCents: req.monthlyBudgetCents ?? 0 },
    });
    await this.audit.record(me, { module: MODULE, entity: 'RecruitRequisition', entityId: id, action: 'SUBMIT', message: `Requisição ${req.code} enviada; quadro/orçamento reservados`, after: { reservedHeadcount: req.openingsRequested } });
    return this.get(me, id);
  }

  /** Decisão de um passo do workflow (segregação: aprovador ≠ solicitante). */
  async decide(me: AuthPayload, id: string, body: any = {}) {
    const req = await this.requisitionOf(me.companyId, id);
    if (req.status !== 'SUBMITTED') throw new ConflictException('Requisição não está em aprovação.');
    const decision = String(body?.decision ?? '');
    if (!['APPROVED', 'REJECTED', 'RETURNED'].includes(decision)) throw new BadRequestException('Decisão inválida.');
    const segError = checkApprovalSegregation(req.requesterId, me.sub);
    if (segError) throw new ForbiddenException(segError);

    const approvals = await this.prisma.recruitRequisitionApproval.findMany({ where: { requisitionId: id }, orderBy: { order: 'asc' } });
    const steps: ApprovalStep[] = approvals.map((a) => ({ order: a.order, role: a.role, decision: a.decision as ApprovalStep['decision'], approverId: a.approverId }));
    const pending = nextPendingApproval(steps);
    if (!pending) throw new ConflictException('Não há passo de aprovação pendente.');
    const stepRow = approvals.find((a) => a.order === pending.order)!;

    await this.prisma.recruitRequisitionApproval.update({
      where: { id: stepRow.id },
      data: { decision, approverId: me.sub, comment: text(body?.comment), decidedAt: new Date() },
    });
    // Reavalia o resultado consolidado.
    steps.find((s) => s.order === pending.order)!.decision = decision as ApprovalStep['decision'];
    const outcome = approvalOutcome(steps);
    let newStatus: RequisitionStatus | null = null;
    if (outcome === 'APPROVED') newStatus = 'APPROVED';
    else if (outcome === 'REJECTED') newStatus = 'REJECTED';
    else if (outcome === 'RETURNED') newStatus = 'RETURNED';
    if (newStatus) {
      const data: Prisma.RecruitRequisitionUpdateInput = { status: newStatus };
      if (newStatus === 'REJECTED' || newStatus === 'RETURNED') { data.reservedHeadcount = 0; data.reservedBudgetCents = 0; }
      await this.prisma.recruitRequisition.update({ where: { id }, data });
    }
    await this.audit.record(me, { module: MODULE, entity: 'RecruitRequisition', entityId: id, action: 'APPROVE', message: `Aprovação (${pending.role}): ${decision}`, after: { decision, outcome, newStatus } });
    return this.get(me, id);
  }

  /** Registra uma exceção aprovada de trava (posição/quadro/orçamento). */
  async addGateException(me: AuthPayload, id: string, body: any = {}) {
    const req = await this.requisitionOf(me.companyId, id);
    const kind = String(body?.kind ?? '');
    if (!GATE_KINDS.includes(kind)) throw new BadRequestException(`Tipo de exceção inválido (${GATE_KINDS.join(', ')}).`);
    const reason = text(body?.reason);
    if (!reason) throw new BadRequestException('Justificativa da exceção é obrigatória.');
    const list = [...(Array.isArray(req.gateExceptions) ? (req.gateExceptions as unknown[]) : []), { kind, approvedById: me.sub, at: new Date().toISOString(), reason }];
    await this.prisma.recruitRequisition.update({ where: { id }, data: { gateExceptions: list as unknown as Prisma.InputJsonValue } });
    await this.audit.record(me, { module: MODULE, entity: 'RecruitRequisition', entityId: id, action: 'EXCEPTION', message: `Exceção de trava ${kind} aprovada: ${reason}`, after: { kind } });
    return this.get(me, id);
  }

  /** Avalia as travas (quadro/orçamento) considerando as exceções já aprovadas. */
  async evaluateGate(me: AuthPayload, id: string) {
    const req = await this.requisitionOf(me.companyId, id);
    const availability = await this.computeAvailability(me.companyId, req.orgNodeId, req.id);
    const approvals = await this.prisma.recruitRequisitionApproval.findMany({ where: { requisitionId: id } });
    const fullyApproved = approvals.length > 0 && approvals.every((a) => a.decision === 'APPROVED');
    const details = (req.details ?? {}) as { requiredSkills?: unknown[] };
    const gate = evaluateVacancyGate({
      hasApprovedPosition: Boolean(req.positionId),
      headcountAvailable: availability.headcountAvailable,
      requestedOpenings: req.openingsRequested,
      budgetAvailableCents: availability.budgetAvailableCents,
      requiredMonthlyCents: req.monthlyBudgetCents ?? 0,
      fullyApproved,
      hasDescription: Boolean(req.orgJobId || (Array.isArray(details.requiredSkills) && details.requiredSkills.length)),
      hasRecruiter: Boolean(req.recruiterId),
      hasPipeline: Boolean(req.pipelineTemplateId),
    }, 'FLEXIBLE');
    // Remove das exceções pendentes as que já foram aprovadas.
    const approvedKinds = new Set((Array.isArray(req.gateExceptions) ? (req.gateExceptions as Array<{ kind: string }>) : []).map((e) => e.kind));
    const outstanding = gate.exceptionsRequired.filter((k) => !approvedKinds.has(k));
    return { ...gate, exceptionsRequired: outstanding, availability, approvedExceptions: [...approvedKinds] };
  }

  /** Encaminha ao recrutamento (cria a vaga é F2). Exige gate ok e exceções resolvidas. */
  async sendToRecruitment(me: AuthPayload, id: string) {
    const req = await this.requisitionOf(me.companyId, id);
    this.assertTransition(req.status as RequisitionStatus, 'SENT_TO_RECRUITMENT');
    const gate = await this.evaluateGate(me, id);
    if (gate.blocks.length) throw new BadRequestException(`Pendências impedem o encaminhamento: ${gate.blocks.join(' ')}`);
    if (gate.exceptionsRequired.length) throw new BadRequestException(`Exceções pendentes de aprovação: ${gate.exceptionsRequired.join(', ')}.`);
    await this.prisma.recruitRequisition.update({ where: { id }, data: { status: 'SENT_TO_RECRUITMENT' } });
    await this.audit.record(me, { module: MODULE, entity: 'RecruitRequisition', entityId: id, action: 'SEND', message: `Requisição ${req.code} encaminhada ao recrutamento` });
    return this.get(me, id);
  }

  /** Cancela e LIBERA a reserva de quadro/orçamento. */
  async cancel(me: AuthPayload, id: string, body: any = {}) {
    const req = await this.requisitionOf(me.companyId, id);
    this.assertTransition(req.status as RequisitionStatus, 'CANCELLED');
    await this.prisma.$transaction(async (tx) => {
      await tx.recruitRequisition.update({ where: { id }, data: { status: 'CANCELLED', reservedHeadcount: 0, reservedBudgetCents: 0, notes: text(body?.reason) ?? req.notes } });
      await tx.recruitRequisitionOpening.updateMany({ where: { requisitionId: id, status: { in: ['OPEN', 'RESERVED'] } }, data: { status: 'CANCELLED' } });
    });
    await this.audit.record(me, { module: MODULE, entity: 'RecruitRequisition', entityId: id, action: 'CANCEL', message: `Requisição ${req.code} cancelada; reserva liberada`, before: { reservedHeadcount: req.reservedHeadcount } });
    return this.get(me, id);
  }

  // ------------------------------ helpers ------------------------------

  /** Saldo de quadro/orçamento da área (do CompensationBudget), menos ocupado e reservado. */
  private async computeAvailability(companyId: string, orgNodeId: string | null, selfReqId: string): Promise<{ headcountAvailable: number | null; budgetAvailableCents: number | null }> {
    if (!orgNodeId) return { headcountAvailable: null, budgetAvailableCents: null };
    const budget = await this.prisma.compensationBudget.findFirst({
      where: { companyId, orgNodeId, status: 'ACTIVE', deletedAt: null },
      orderBy: { periodRef: 'desc' },
      select: { plannedHeadcount: true, plannedPayroll: true },
    });
    if (!budget) return { headcountAvailable: null, budgetAvailableCents: null };
    const [occupied, reservedAgg] = await Promise.all([
      this.prisma.orgEmployee.count({ where: { companyId, orgNodeId, status: 'ACTIVE' } }),
      this.prisma.recruitRequisition.aggregate({
        where: { companyId, orgNodeId, deletedAt: null, id: { not: selfReqId }, status: { in: ['SUBMITTED', 'APPROVED', 'SENT_TO_RECRUITMENT', 'IN_RECRUITMENT'] } },
        _sum: { reservedHeadcount: true, reservedBudgetCents: true },
      }),
    ]);
    const reservedHc = reservedAgg._sum.reservedHeadcount ?? 0;
    const reservedBudget = reservedAgg._sum.reservedBudgetCents ?? 0;
    return {
      headcountAvailable: budget.plannedHeadcount - occupied - reservedHc,
      budgetAvailableCents: Math.round(Number(budget.plannedPayroll.toString()) * 100) - reservedBudget,
    };
  }

  private async resolveJob(companyId: string, body: any): Promise<string | null> {
    const jobId = text(body?.orgJobId);
    if (jobId) {
      const job = await this.prisma.orgJob.findFirst({ where: { id: jobId, companyId }, select: { id: true } });
      if (!job) throw new NotFoundException('Cargo não encontrado.');
      return job.id;
    }
    return null;
  }

  private async resolvePosition(companyId: string, positionId: unknown): Promise<string | null> {
    const id = text(positionId);
    if (!id) return null;
    const pos = await this.prisma.compensationPosition.findFirst({ where: { id, companyId, deletedAt: null }, select: { id: true } });
    if (!pos) throw new NotFoundException('Posição não encontrada.');
    return pos.id;
  }

  private async buildJobSnapshot(companyId: string, orgJobId: string | null, body: any): Promise<Prisma.InputJsonValue> {
    let job: { name: string; description: string | null; cbo: string | null } | null = null;
    if (orgJobId) job = await this.prisma.orgJob.findFirst({ where: { id: orgJobId, companyId }, select: { name: true, description: true, cbo: true } });
    return {
      jobName: job?.name ?? text(body?.jobName) ?? null,
      cbo: job?.cbo ?? null,
      description: job?.description ?? null,
      requirements: body?.details ?? null,
      capturedAt: new Date().toISOString(),
    };
  }

  private buildApprovalSteps(body: any): Array<{ order: number; role: string; approverId?: string | null }> {
    if (Array.isArray(body?.approvalSteps) && body.approvalSteps.length) {
      return body.approvalSteps.map((s: any, i: number) => ({ order: Number(s.order ?? i + 1), role: String(s.role ?? 'RH'), approverId: text(s.approverId) }));
    }
    // Default: RH; diretoria quando confidencial ou prioridade urgente.
    const steps: Array<{ order: number; role: string; approverId?: string | null }> = [{ order: 1, role: 'RH' }];
    if (body?.confidential || body?.priority === 'URGENTE') steps.push({ order: 2, role: 'DIRECTOR' });
    return steps;
  }

  private async nextCode(companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.recruitRequisition.count({ where: { companyId, code: { startsWith: `RQ-${year}-` } } });
    return `RQ-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  private assertTransition(from: RequisitionStatus, to: RequisitionStatus) {
    if (!canTransition(from, to)) throw new ConflictException(`Transição inválida de ${from} para ${to}.`);
  }

  private async requisitionOf(companyId: string, id: string) {
    const req = await this.prisma.recruitRequisition.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!req) throw new NotFoundException('Requisição não encontrada.');
    return req;
  }
}

function text(value: unknown): string | null {
  const t = String(value ?? '').trim();
  return t || null;
}
