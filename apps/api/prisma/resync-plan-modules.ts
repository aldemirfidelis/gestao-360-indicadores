/**
 * Re-sincroniza planos e módulos por empresa com o novo modelo de módulos de
 * NEGÓCIO (alinhado às abas do menu). Sanitiza os ajustes manuais que ficaram
 * inconsistentes (ex.: Painel Executivo bloqueado).
 *
 * O QUE FAZ:
 *  1. Reescreve PlatformPlanModule de cada plano conforme a matriz cumulativa.
 *  2. Re-aplica o plano de CADA empresa em PlatformCompanyModule:
 *     incluídos -> HERDADO_DO_PLANO ; demais -> BLOQUEADO (reseta overrides manuais).
 *
 * ⚠️ Reseta sobrescritas manuais de módulo para o padrão do plano (é o objetivo:
 *    sanitizar). Núcleo (Meu Dia, Tarefas, Administração) + sistema ficam sempre ativos.
 *
 * Mantém o conteúdo em sincronia com src/modules/portal-admin/business-modules.ts.
 *
 * Rodar:  pnpm -C apps/api exec tsx prisma/resync-plan-modules.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Membros granulares por aba de negócio (espelha business-modules.ts).
const CORE_MEMBERS = ['my-day', 'tasks', 'aprovacoes-cargo', 'periods', 'automations', 'users', 'reports'];
const SYSTEM_MEMBERS = ['auth', 'access-control', 'settings', 'audit', 'database-admin', 'portal-admin', 'integrations', 'help-center', 'directory'];
const ALWAYS_ON = Array.from(new Set([...CORE_MEMBERS, ...SYSTEM_MEMBERS]));

const BUSINESS_MEMBERS: Record<string, string[]> = {
  'gestao-a-vista': ['visualization', 'dashboard', 'org', 'strategy', 'indicators', 'deviations', 'actions', 'meetings', 'monthly-results', 'okrs', 'insights', 'treatments', 'imports', 'eficacia'],
  'qualidade-compliance': ['risks', 'nonconformities', 'audits', 'documents', 'processes', 'forms', 'projects', 'vision360'],
  'comunicacao': ['communication'],
  'cargos-salarios': ['compensation'],
  'seguranca-alimentos': ['food-safety'],
  'seguranca-patrimonial': ['asset-security'],
  'gestao-premio': ['prize'],
};

const PLAN_BUSINESS_MODULES: Record<string, string[]> = {
  ESSENCIAL: ['gestao-a-vista'],
  PROFISSIONAL: ['gestao-a-vista', 'qualidade-compliance', 'comunicacao'],
  CORPORATIVO: ['gestao-a-vista', 'qualidade-compliance', 'comunicacao', 'cargos-salarios', 'seguranca-alimentos', 'seguranca-patrimonial'],
  ENTERPRISE: ['gestao-a-vista', 'qualidade-compliance', 'comunicacao', 'cargos-salarios', 'seguranca-alimentos', 'seguranca-patrimonial', 'gestao-premio'],
  PERSONALIZADO: [],
};

function expandPlanModules(planCode: string): Set<string> {
  const business = (PLAN_BUSINESS_MODULES[planCode] ?? []).flatMap((code) => BUSINESS_MEMBERS[code] ?? []);
  return new Set([...ALWAYS_ON, ...business]);
}

async function main() {
  const catalog = await prisma.platformModuleCatalog.findMany({ select: { code: true } });
  const catalogCodes = catalog.map((m) => m.code);
  if (catalogCodes.length === 0) {
    console.log('Catálogo de módulos vazio — rode a sincronização do Portal Admin antes.');
    return;
  }

  // 1. Planos
  const plans = await prisma.platformPlan.findMany({ where: { deletedAt: null }, select: { id: true, code: true } });
  for (const plan of plans) {
    const expanded = expandPlanModules(plan.code);
    await prisma.$transaction([
      prisma.platformPlanModule.deleteMany({ where: { planId: plan.id } }),
      prisma.platformPlanModule.createMany({
        data: catalogCodes.map((code) => ({ planId: plan.id, moduleCode: code, included: expanded.has(code) })),
        skipDuplicates: true,
      }),
    ]);
    const included = catalogCodes.filter((c) => expanded.has(c)).length;
    console.log(`Plano ${plan.code}: ${included}/${catalogCodes.length} módulos incluídos.`);
  }

  // 2. Empresas — re-aplica o plano (reseta para o padrão).
  const companies = await prisma.company.findMany({ where: { deletedAt: null }, select: { id: true, name: true } });
  const profiles = await prisma.platformCompanyProfile.findMany({ select: { companyId: true, planCode: true } });
  const planByCompany = new Map(profiles.map((p) => [p.companyId, p.planCode]));

  for (const company of companies) {
    const planCode = planByCompany.get(company.id) ?? 'ESSENCIAL';
    const expanded = expandPlanModules(planCode);
    for (const code of catalogCodes) {
      const status = expanded.has(code) ? 'HERDADO_DO_PLANO' : 'BLOQUEADO';
      await prisma.platformCompanyModule.upsert({
        where: { companyId_moduleCode: { companyId: company.id, moduleCode: code } },
        create: { companyId: company.id, moduleCode: code, status, inheritedFromPlan: true, manuallyOverridden: false, updatedByEmail: 'resync-script' },
        update: { status, inheritedFromPlan: true, manuallyOverridden: false, updatedByEmail: 'resync-script' },
      });
    }
    const active = catalogCodes.filter((c) => expanded.has(c)).length;
    console.log(`  ${company.name} [${planCode}]: ${active} módulos ativos.`);
  }

  console.log(`\nOK: ${plans.length} plano(s) e ${companies.length} empresa(s) re-sincronizados.`);
}

main()
  .catch((err) => {
    console.error('Falha no re-sync:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
