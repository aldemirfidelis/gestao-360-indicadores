import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditWriterService } from '../../common/audit/audit-writer.service';
import { AuthPayload } from '../auth/auth.types';
import { DEFAULT_PIPELINE_STAGES, slugify } from './recruit-posting.logic';

const MODULE = 'recruitment';
const POSTING_STATUSES = ['DRAFT', 'PUBLISHED', 'PAUSED', 'CLOSED'];
const VISIBILITIES = ['PUBLIC', 'INTERNAL', 'BOTH', 'CONFIDENTIAL'];

/**
 * Vagas (postings) e pipelines de seleção (F2). A vaga nasce de uma requisição
 * encaminhada ao recrutamento; importa a descrição do cargo (snapshot protegido)
 * e um texto público editável. Publicar exige pipeline e descrição.
 */
@Injectable()
export class RecruitPostingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriterService,
  ) {}

  // ------------------------------ pipelines ------------------------------

  /** Garante o template padrão de pipeline (uma vez por empresa). */
  async ensureDefaultPipeline(companyId: string, userId?: string): Promise<string> {
    const existing = await this.prisma.recruitPipelineTemplate.findFirst({ where: { companyId, isDefault: true } });
    if (existing) return existing.id;
    const template = await this.prisma.recruitPipelineTemplate.create({
      data: {
        companyId, name: 'Pipeline padrão', isDefault: true, createdById: userId,
        stages: { create: DEFAULT_PIPELINE_STAGES.map((s) => ({ companyId, order: s.order, name: s.name, type: s.type })) },
      },
    });
    return template.id;
  }

  async listPipelines(me: AuthPayload) {
    await this.ensureDefaultPipeline(me.companyId, me.sub);
    return this.prisma.recruitPipelineTemplate.findMany({
      where: { companyId: me.companyId, active: true },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      include: { stages: { orderBy: { order: 'asc' } } },
    });
  }

  async createPipeline(me: AuthPayload, body: any = {}) {
    const name = String(body?.name ?? '').trim();
    if (!name) throw new BadRequestException('Nome do pipeline é obrigatório.');
    const stages: Array<{ name: string; type?: string }> = Array.isArray(body?.stages) && body.stages.length ? body.stages : DEFAULT_PIPELINE_STAGES;
    const created = await this.prisma.recruitPipelineTemplate.create({
      data: {
        companyId: me.companyId, name, createdById: me.sub,
        stages: { create: stages.map((s, i) => ({ companyId: me.companyId, order: i + 1, name: String(s.name), type: String((s as any).type ?? 'STANDARD') })) },
      },
      include: { stages: { orderBy: { order: 'asc' } } },
    });
    await this.audit.record(me, { module: MODULE, entity: 'RecruitPipelineTemplate', entityId: created.id, action: 'CREATE', message: `Pipeline "${name}" criado` });
    return created;
  }

  // ------------------------------ vagas ------------------------------

  /** Cria a vaga a partir de uma requisição encaminhada ao recrutamento. */
  async createFromRequisition(me: AuthPayload, requisitionId: string) {
    const req = await this.prisma.recruitRequisition.findFirst({
      where: { id: requisitionId, companyId: me.companyId, deletedAt: null },
      include: { snapshots: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!req) throw new NotFoundException('Requisição não encontrada.');
    if (!['SENT_TO_RECRUITMENT', 'IN_RECRUITMENT'].includes(req.status)) {
      throw new ConflictException('Encaminhe a requisição ao recrutamento antes de criar a vaga.');
    }
    const existing = await this.prisma.recruitJobPosting.findFirst({ where: { companyId: me.companyId, requisitionId, deletedAt: null }, select: { id: true } });
    if (existing) throw new ConflictException('Esta requisição já possui uma vaga.');

    const snapshot = (req.snapshots[0]?.jobData ?? {}) as { jobName?: string; description?: string; requirements?: unknown };
    const title = snapshot.jobName ?? 'Vaga';
    const slug = await this.uniqueSlug(me.companyId, slugify(title));
    const pipelineTemplateId = await this.ensureDefaultPipeline(me.companyId, me.sub);
    const node = req.orgNodeId ? await this.prisma.orgNode.findFirst({ where: { id: req.orgNodeId, companyId: me.companyId }, select: { name: true } }) : null;

    const created = await this.prisma.recruitJobPosting.create({
      data: {
        companyId: me.companyId,
        requisitionId,
        slug,
        title,
        publicDescription: snapshot.description ?? null,
        location: req.location,
        city: req.city,
        workMode: req.workMode,
        contractType: req.contractType,
        orgNodeId: req.orgNodeId,
        areaName: node?.name ?? null,
        visibility: req.recruitmentScope === 'INTERNAL' ? 'INTERNAL' : req.confidential ? 'CONFIDENTIAL' : 'PUBLIC',
        pipelineTemplateId,
        protectedSnapshot: (req.snapshots[0]?.jobData ?? undefined) as Prisma.InputJsonValue | undefined,
        createdById: me.sub,
      },
    });
    // Marca a requisição como em recrutamento.
    if (req.status === 'SENT_TO_RECRUITMENT') {
      await this.prisma.recruitRequisition.update({ where: { id: requisitionId }, data: { status: 'IN_RECRUITMENT' } });
    }
    await this.audit.record(me, { module: MODULE, entity: 'RecruitJobPosting', entityId: created.id, action: 'CREATE', message: `Vaga "${title}" criada a partir de ${req.code}` });
    return this.getPosting(me, created.id);
  }

  async listPostings(me: AuthPayload, status?: string) {
    // RecruitJobPosting não tem relação `company` (só o escalar companyId), então o
    // slug (usado p/ montar o link público ?empresa=) vem numa query à parte.
    const [postings, company] = await Promise.all([
      this.prisma.recruitJobPosting.findMany({
        where: { companyId: me.companyId, deletedAt: null, ...(status ? { status } : {}) },
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: { channels: true, pipelineTemplate: { select: { name: true } }, _count: { select: { applications: true } } },
      }),
      this.prisma.company.findUnique({ where: { id: me.companyId }, select: { slug: true } }),
    ]);
    return postings.map((p) => ({ ...p, company: { slug: company?.slug ?? null } }));
  }

  async getPosting(me: AuthPayload, id: string) {
    const [posting, company] = await Promise.all([
      this.prisma.recruitJobPosting.findFirst({
        where: { id, companyId: me.companyId, deletedAt: null },
        include: { channels: true, pipelineTemplate: { include: { stages: { orderBy: { order: 'asc' } } } } },
      }),
      this.prisma.company.findUnique({ where: { id: me.companyId }, select: { slug: true } }),
    ]);
    if (!posting) throw new NotFoundException('Vaga não encontrada.');
    return { ...posting, company: { slug: company?.slug ?? null } };
  }

  async updatePosting(me: AuthPayload, id: string, body: any = {}) {
    const posting = await this.postingOf(me.companyId, id);
    const data: Prisma.RecruitJobPostingUpdateInput = {};
    for (const field of ['title', 'publicDescription', 'publicRequirements', 'benefitsText', 'processStepsText', 'location', 'city', 'workMode', 'contractType', 'salaryText'] as const) {
      if (field in body) (data as Record<string, unknown>)[field] = text(body[field]);
    }
    if ('visibility' in body) {
      if (!VISIBILITIES.includes(String(body.visibility))) throw new BadRequestException('Visibilidade inválida.');
      data.visibility = String(body.visibility);
    }
    if ('pcd' in body) data.pcd = Boolean(body.pcd);
    if ('showSalary' in body) data.showSalary = Boolean(body.showSalary);
    if ('closesAt' in body) data.closesAt = body.closesAt ? new Date(body.closesAt) : null;
    if ('applicationLimit' in body) data.applicationLimit = body.applicationLimit == null ? null : Math.round(Number(body.applicationLimit));
    if ('pipelineTemplateId' in body) {
      const tpl = body.pipelineTemplateId ? await this.prisma.recruitPipelineTemplate.findFirst({ where: { id: String(body.pipelineTemplateId), companyId: me.companyId }, select: { id: true } }) : null;
      data.pipelineTemplate = tpl ? { connect: { id: tpl.id } } : { disconnect: true };
    }
    const updated = await this.prisma.recruitJobPosting.update({ where: { id }, data });
    await this.audit.record(me, { module: MODULE, entity: 'RecruitJobPosting', entityId: id, action: 'UPDATE', message: `Vaga "${posting.title}" atualizada` });
    return this.getPosting(me, id);
  }

  async publish(me: AuthPayload, id: string) {
    const posting = await this.postingOf(me.companyId, id);
    if (!posting.publicDescription) throw new BadRequestException('Adicione a descrição pública antes de publicar.');
    if (!posting.pipelineTemplateId) throw new BadRequestException('Defina o pipeline de seleção antes de publicar.');
    const updated = await this.prisma.recruitJobPosting.update({ where: { id }, data: { status: 'PUBLISHED', publishedAt: posting.publishedAt ?? new Date() } });
    // Canal Carreiras por padrão.
    const hasCareers = await this.prisma.recruitPostingChannel.findFirst({ where: { postingId: id, channel: 'CARREIRAS' } });
    if (!hasCareers) await this.prisma.recruitPostingChannel.create({ data: { companyId: me.companyId, postingId: id, channel: 'CARREIRAS', publishedAt: new Date() } });
    await this.audit.record(me, { module: MODULE, entity: 'RecruitJobPosting', entityId: id, action: 'PUBLISH', message: `Vaga "${posting.title}" publicada`, after: { visibility: posting.visibility } });
    return this.getPosting(me, id);
  }

  async setStatus(me: AuthPayload, id: string, status: string) {
    if (!POSTING_STATUSES.includes(status)) throw new BadRequestException('Status inválido.');
    const posting = await this.postingOf(me.companyId, id);
    await this.prisma.recruitJobPosting.update({ where: { id }, data: { status } });
    await this.audit.record(me, { module: MODULE, entity: 'RecruitJobPosting', entityId: id, action: 'STATUS', message: `Vaga "${posting.title}" → ${status}` });
    return this.getPosting(me, id);
  }

  private async uniqueSlug(companyId: string, base: string): Promise<string> {
    let slug = base;
    let n = 1;
    // eslint-disable-next-line no-constant-condition
    while (await this.prisma.recruitJobPosting.findFirst({ where: { companyId, slug }, select: { id: true } })) {
      n += 1;
      slug = `${base}-${n}`;
    }
    return slug;
  }

  private async postingOf(companyId: string, id: string) {
    const posting = await this.prisma.recruitJobPosting.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!posting) throw new NotFoundException('Vaga não encontrada.');
    return posting;
  }
}

function text(value: unknown): string | null {
  const t = String(value ?? '').trim();
  return t || null;
}
