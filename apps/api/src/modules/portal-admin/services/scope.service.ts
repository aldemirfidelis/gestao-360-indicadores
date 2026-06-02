import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthPayload } from '../../auth/auth.types';
import { PortalAuditService } from './portal-audit.service';

const TARGET_TYPES = ['module', 'page', 'feature'];
const SCOPE_TYPES = ['company', 'branch', 'orgnode', 'user', 'role'];

@Injectable()
export class ScopeService {
  constructor(private readonly prisma: PrismaService, private readonly audit: PortalAuditService) {}

  list(targetType?: string, targetCode?: string) {
    return this.prisma.portalScopeRule.findMany({
      where: { ...(targetType ? { targetType } : {}), ...(targetCode ? { targetCode } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Estruturas organizacionais disponíveis para escopo (empresas, filiais, áreas). */
  async options() {
    const [companies, branches, orgNodes] = await Promise.all([
      this.prisma.company.findMany({ where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      this.prisma.branch.findMany({ where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      this.prisma.orgNode.findMany({ where: { deletedAt: null }, select: { id: true, name: true, type: true }, orderBy: { name: 'asc' }, take: 500 }),
    ]);
    return { companies, branches, orgNodes };
  }

  async create(input: { targetType: string; targetCode: string; scopeType: string; scopeId: string; effect?: string }, user: AuthPayload) {
    if (!TARGET_TYPES.includes(input.targetType)) throw new BadRequestException('targetType inválido');
    if (!SCOPE_TYPES.includes(input.scopeType)) throw new BadRequestException('scopeType inválido');
    const rule = await this.prisma.portalScopeRule.create({
      data: { targetType: input.targetType, targetCode: input.targetCode, scopeType: input.scopeType, scopeId: input.scopeId, effect: input.effect === 'deny' ? 'deny' : 'allow', createdBy: user.sub },
    });
    await this.audit.record({ user, tab: 'scope', action: 'CREATE', targetType: input.targetType, targetCode: input.targetCode, afterValue: rule });
    return rule;
  }

  async remove(id: string, user: AuthPayload) {
    await this.prisma.portalScopeRule.deleteMany({ where: { id } });
    await this.audit.record({ user, tab: 'scope', action: 'DELETE', targetType: 'scopeRule', targetCode: id });
    return { ok: true };
  }
}
