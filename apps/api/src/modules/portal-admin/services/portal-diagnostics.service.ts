import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthPayload } from '../../auth/auth.types';
import { PortalAuditService } from './portal-audit.service';
import { CATALOG_MODULES } from '../portal-catalog';

export interface PortalFinding {
  id: string;
  level: 'info' | 'warning' | 'risk' | 'high' | 'critical';
  category: string;
  title: string;
  description: string;
  suggestion?: string;
}

@Injectable()
export class PortalDiagnosticsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: PortalAuditService) {}

  async run(user?: AuthPayload) {
    const findings: PortalFinding[] = [];
    const [modules, pages, navOverrides, integrations] = await Promise.all([
      this.prisma.portalModule.findMany(),
      this.prisma.portalPage.findMany(),
      this.prisma.portalNavOverride.findMany(),
      this.prisma.portalIntegration.findMany(),
    ]);

    // Registro desatualizado vs catálogo
    const regCodes = new Set(modules.map((m) => m.code));
    const missing = CATALOG_MODULES.filter((c) => !regCodes.has(c.code));
    if (missing.length > 0) findings.push({ id: 'registry-stale', level: 'warning', category: 'Registro', title: 'Registro desatualizado', description: `${missing.length} módulo(s) do catálogo não registrado(s): ${missing.map((m) => m.code).join(', ')}.`, suggestion: 'Clique em "Ressincronizar registro" na aba Módulos.' });
    if (modules.length === 0) findings.push({ id: 'registry-empty', level: 'info', category: 'Registro', title: 'Registro vazio', description: 'Nenhum módulo registrado ainda.', suggestion: 'Ressincronizar registro.' });

    // Páginas cujo módulo não existe no registro
    for (const p of pages) if (p.moduleCode && !regCodes.has(p.moduleCode)) findings.push({ id: `page-orphan-${p.code}`, level: 'warning', category: 'Páginas', title: 'Página órfã', description: `Página ${p.code} referencia módulo inexistente ${p.moduleCode}.` });

    // Módulos críticos bloqueados (não deveria ocorrer — proteção anti-lockout)
    for (const m of modules) if (m.nonBlockable && ['INACTIVE', 'BLOCKED', 'MAINTENANCE'].includes(m.status)) findings.push({ id: `critical-blocked-${m.code}`, level: 'critical', category: 'Segurança', title: 'Módulo essencial indisponível', description: `O módulo essencial ${m.code} está ${m.status}.`, suggestion: 'Reative imediatamente.' });

    // Páginas bloqueadas
    const blocked = pages.filter((p) => ['BLOCKED', 'INACTIVE', 'MAINTENANCE'].includes(p.status));
    if (blocked.length > 0) findings.push({ id: 'pages-blocked', level: 'info', category: 'Páginas', title: 'Páginas indisponíveis', description: `${blocked.length} página(s) bloqueada(s)/em manutenção.` });

    // Nav overrides para itens ocultos
    const hiddenNav = navOverrides.filter((n) => n.hidden);
    if (hiddenNav.length > 0) findings.push({ id: 'nav-hidden', level: 'info', category: 'Menus', title: 'Itens de menu ocultos', description: `${hiddenNav.length} item(ns) ocultos por override.` });

    // Integrações com falha
    const failing = integrations.filter((i) => i.recentFailures > 0);
    if (failing.length > 0) findings.push({ id: 'integrations-failing', level: 'risk', category: 'Integrações', title: 'Integrações com falha', description: `${failing.map((i) => i.code).join(', ')} com falhas recentes.`, suggestion: 'Testar conexão na aba Integrações.' });

    const summary = { critical: findings.filter((f) => f.level === 'critical').length, high: findings.filter((f) => f.level === 'high').length, risk: findings.filter((f) => f.level === 'risk').length, warning: findings.filter((f) => f.level === 'warning').length, info: findings.filter((f) => f.level === 'info').length };

    const run = await this.prisma.portalDiagnosticRun.create({ data: { summary: JSON.stringify(summary), findings: JSON.stringify(findings), createdBy: user?.sub ?? null, createdByEmail: user?.email ?? null } });
    if (user) await this.audit.record({ user, tab: 'diagnostics', action: 'RUN', targetType: 'diagnostics', targetCode: run.id, message: `Diagnóstico: ${findings.length} achado(s).` });
    return { generatedAt: run.createdAt, summary, findings };
  }
}
