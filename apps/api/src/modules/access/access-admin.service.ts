import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AreaAssignmentType, VisibilityEffect } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditWriterService } from '../../common/audit/audit-writer.service';
import { AuthPayload } from '../auth/auth.types';
import { AccessService } from './access.service';
import { swallow } from '../../common/logging/swallow';
import { ACCESS_MODULES, AddAssignmentDto, CreateExceptionDto, UpsertMatrixRuleDto } from './access-admin.dto';
import { AreaAction } from './access.logic';

@Injectable()
export class AccessAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly auditWriter: AuditWriterService,
  ) {}

  modules() {
    return ACCESS_MODULES;
  }

  /** Áreas (OrgNode) da empresa para seletores da matriz. */
  async areas(companyId: string) {
    return this.prisma.orgNode.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true, name: true, type: true, parentId: true },
      orderBy: [{ name: 'asc' }],
    });
  }

  // ---------- Atribuições de área do usuário ----------
  async userAreas(companyId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, companyId, deletedAt: null },
      select: { id: true, name: true, defaultNodeId: true },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado nesta empresa.');
    const assignments = await this.prisma.userAreaAssignment.findMany({
      where: { userId, companyId },
      orderBy: { isPrimary: 'desc' },
    });
    return { primaryAreaId: user.defaultNodeId, assignments };
  }

  async addAssignment(me: AuthPayload, companyId: string, userId: string, dto: AddAssignmentDto) {
    await this.assertUserInCompany(companyId, userId);
    await this.assertAreaInCompany(companyId, dto.orgNodeId);
    const created = await this.prisma.userAreaAssignment.upsert({
      where: { userId_orgNodeId: { userId, orgNodeId: dto.orgNodeId } },
      create: {
        userId,
        companyId,
        orgNodeId: dto.orgNodeId,
        assignmentType: dto.assignmentType ?? AreaAssignmentType.SECONDARY,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
      },
      update: {
        assignmentType: dto.assignmentType ?? AreaAssignmentType.SECONDARY,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
      },
    });
    this.access.invalidate(userId);
    await this.audit(me, companyId, 'GRANT_AREA', 'UserAreaAssignment', created.id, null, created);
    return created;
  }

  async removeAssignment(me: AuthPayload, companyId: string, userId: string, orgNodeId: string) {
    await this.assertUserInCompany(companyId, userId);
    const existing = await this.prisma.userAreaAssignment.findUnique({ where: { userId_orgNodeId: { userId, orgNodeId } } });
    if (!existing || existing.companyId !== companyId) throw new NotFoundException('Atribuição não encontrada.');
    if (existing.isPrimary) throw new BadRequestException('Não é possível remover a área principal. Defina outra antes.');
    await this.prisma.userAreaAssignment.delete({ where: { userId_orgNodeId: { userId, orgNodeId } } });
    this.access.invalidate(userId);
    await this.audit(me, companyId, 'REVOKE_AREA', 'UserAreaAssignment', existing.id, existing, null);
    return { ok: true };
  }

  async setPrimaryArea(me: AuthPayload, companyId: string, userId: string, orgNodeId: string) {
    await this.assertUserInCompany(companyId, userId);
    await this.assertAreaInCompany(companyId, orgNodeId);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { defaultNodeId: orgNodeId } }),
      this.prisma.userAreaAssignment.updateMany({ where: { userId, companyId }, data: { isPrimary: false } }),
      this.prisma.userAreaAssignment.upsert({
        where: { userId_orgNodeId: { userId, orgNodeId } },
        create: { userId, companyId, orgNodeId, assignmentType: AreaAssignmentType.PRIMARY, isPrimary: true },
        update: { assignmentType: AreaAssignmentType.PRIMARY, isPrimary: true },
      }),
    ]);
    this.access.invalidate(userId);
    await this.audit(me, companyId, 'SET_PRIMARY_AREA', 'User', userId, null, { defaultNodeId: orgNodeId });
    return { ok: true };
  }

  // ---------- Matriz de visibilidade ----------
  async matrix(companyId: string) {
    const rules = await this.prisma.areaVisibilityRule.findMany({ where: { companyId }, orderBy: { createdAt: 'asc' } });
    const areas = await this.areas(companyId);
    const nameOf = new Map(areas.map((a) => [a.id, a.name]));
    return rules.map((r) => ({
      ...r,
      sourceAreaName: nameOf.get(r.sourceAreaId) ?? '—',
      targetAreaName: nameOf.get(r.targetAreaId) ?? '—',
    }));
  }

  async upsertRule(me: AuthPayload, companyId: string, dto: UpsertMatrixRuleDto) {
    if (dto.sourceAreaId === dto.targetAreaId) throw new BadRequestException('Área de origem e destino não podem ser iguais.');
    await this.assertAreaInCompany(companyId, dto.sourceAreaId);
    await this.assertAreaInCompany(companyId, dto.targetAreaId);
    if (dto.moduleKey !== '*' && !ACCESS_MODULES.includes(dto.moduleKey as (typeof ACCESS_MODULES)[number])) {
      throw new BadRequestException('Módulo inválido.');
    }
    const data = {
      visibilityLevel: dto.visibilityLevel,
      canView: dto.canView ?? true,
      canCreate: dto.canCreate ?? false,
      canEdit: dto.canEdit ?? false,
      canDelete: dto.canDelete ?? false,
      canApprove: dto.canApprove ?? false,
      canExport: dto.canExport ?? false,
      createdBy: me.sub,
    };
    const rule = await this.prisma.areaVisibilityRule.upsert({
      where: {
        companyId_sourceAreaId_targetAreaId_moduleKey: {
          companyId,
          sourceAreaId: dto.sourceAreaId,
          targetAreaId: dto.targetAreaId,
          moduleKey: dto.moduleKey,
        },
      },
      create: { companyId, sourceAreaId: dto.sourceAreaId, targetAreaId: dto.targetAreaId, moduleKey: dto.moduleKey, ...data },
      update: data,
    });
    this.invalidateCompany(companyId);
    await this.audit(me, companyId, 'MATRIX_UPSERT', 'AreaVisibilityRule', rule.id, null, rule);
    return rule;
  }

  async removeRule(me: AuthPayload, companyId: string, id: string) {
    const rule = await this.prisma.areaVisibilityRule.findUnique({ where: { id } });
    if (!rule || rule.companyId !== companyId) throw new NotFoundException('Regra não encontrada.');
    await this.prisma.areaVisibilityRule.delete({ where: { id } });
    this.invalidateCompany(companyId);
    await this.audit(me, companyId, 'MATRIX_DELETE', 'AreaVisibilityRule', id, rule, null);
    return { ok: true };
  }

  // ---------- Exceções individuais ----------
  async exceptions(companyId: string, userId?: string) {
    return this.prisma.userVisibilityException.findMany({
      where: { companyId, ...(userId ? { userId } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createException(me: AuthPayload, companyId: string, dto: CreateExceptionDto) {
    await this.assertUserInCompany(companyId, dto.userId);
    await this.assertAreaInCompany(companyId, dto.targetAreaId);
    const created = await this.prisma.userVisibilityException.create({
      data: {
        companyId,
        userId: dto.userId,
        targetAreaId: dto.targetAreaId,
        moduleKey: dto.moduleKey,
        effect: dto.effect as VisibilityEffect,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        reason: dto.reason ?? null,
        createdBy: me.sub,
      },
    });
    this.access.invalidate(dto.userId);
    await this.audit(me, companyId, 'EXCEPTION_CREATE', 'UserVisibilityException', created.id, null, created);
    return created;
  }

  async removeException(me: AuthPayload, companyId: string, id: string) {
    const exc = await this.prisma.userVisibilityException.findUnique({ where: { id } });
    if (!exc || exc.companyId !== companyId) throw new NotFoundException('Exceção não encontrada.');
    await this.prisma.userVisibilityException.delete({ where: { id } });
    this.access.invalidate(exc.userId);
    await this.audit(me, companyId, 'EXCEPTION_DELETE', 'UserVisibilityException', id, exc, null);
    return { ok: true };
  }

  // ---------- Simular acesso ----------
  async simulate(userId: string) {
    const ctx = await this.access.getContext(userId);
    const areas = await this.areas(ctx.companyId);
    const nameOf = new Map(areas.map((a) => [a.id, a.name]));
    const perModule: Array<{ module: string; view: string; edit: string }> = [];
    for (const m of ACCESS_MODULES) {
      const view = await this.access.permittedAreaIds(userId, m, 'view' as AreaAction);
      const edit = await this.access.permittedAreaIds(userId, m, 'edit' as AreaAction);
      perModule.push({
        module: m,
        view: view === 'ALL' ? 'Todas as áreas' : view.map((id) => nameOf.get(id) ?? id).join(', ') || '—',
        edit: edit === 'ALL' ? 'Todas as áreas' : edit.map((id) => nameOf.get(id) ?? id).join(', ') || '—',
      });
    }
    return {
      context: {
        role: ctx.role,
        companyWide: ctx.companyWide,
        areaAccessEnabled: ctx.areaAccessEnabled,
        primaryArea: ctx.primaryAreaId ? nameOf.get(ctx.primaryAreaId) ?? ctx.primaryAreaId : null,
        ownAreas: ctx.ownAreaIds.map((id) => nameOf.get(id) ?? id),
      },
      perModule,
    };
  }

  // ---------- helpers ----------
  private async assertUserInCompany(companyId: string, userId: string) {
    const u = await this.prisma.user.findFirst({ where: { id: userId, companyId, deletedAt: null }, select: { id: true } });
    if (!u) throw new NotFoundException('Usuário não encontrado nesta empresa.');
  }
  private async assertAreaInCompany(companyId: string, orgNodeId: string) {
    const n = await this.prisma.orgNode.findFirst({ where: { id: orgNodeId, companyId, deletedAt: null }, select: { id: true } });
    if (!n) throw new BadRequestException('Área inválida para esta empresa.');
  }
  private async invalidateCompany(companyId: string) {
    const users = await this.prisma.user.findMany({ where: { companyId, deletedAt: null }, select: { id: true } });
    for (const u of users) this.access.invalidate(u.id);
  }
  private async audit(me: AuthPayload, companyId: string, action: string, entity: string, entityId: string, before: unknown, after: unknown) {
    await this.auditWriter.record({ companyId, sub: me.sub }, { action, module: 'access', entity, entityId, before, after });
  }
}
