/* eslint-disable no-console */
/**
 * Popula o exemplo OFICIAL do anexo PREMIO ESTRADAS - 0561 (cargo Coordenador
 * de Área) na Gestão de Prêmio, replicando fielmente a planilha
 * `Gestao_premio/Bases_calculo/Cópia de PREMIO ESTRADAS - ANEXO-0561.xlsx`.
 *
 * Faz, na ordem em que um operador faria manualmente na plataforma:
 *  1. cria Área Agrícola + Setor Estradas na árvore organizacional (sem responsável);
 *  2. cria os 2 indicadores NATIVOS (módulo Visualizações), donos = Setor Estradas;
 *  3. apaga os dados de TESTE do prêmio da empresa (limpa o módulo);
 *  4. cria Programa → Anexo 0561 → versão (workflow até VIGENTE) → 12 competências;
 *  5. vincula os 2 indicadores ao prêmio (peso 50 cada) + parâmetros mensais
 *     (zero/meta) + faixas (22780 fixo; 32131 com faixas que mudam por mês);
 *  6. carrega os moderadores do modelo oficial (falta/suspensão 34%, medida 50%,
 *     acidente 50%, atestado 20% com 1º abonado).
 *
 * Idempotente: reusa árvore/indicadores nativos pelo nome/código; o prêmio é
 * recriado do zero (apaga e popula). Dados do anexo em prisma/data/prize-estradas-0561.json.
 *
 * Uso: npx tsx prisma/seed-prize-estradas.ts   (env opcionais: SEED_ADMIN_EMAIL, SEED_COMPANY_ID)
 */
import {
  PrismaClient,
  OrgNodeType,
  IndicatorType,
  IndicatorUnit,
  Periodicity,
  Direction,
  FeedKind,
  IndicatorStatus,
} from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'aldemir.fidelis@gmail.com';

interface FaixaJson { orderIndex: number; minLimit: number; maxLimit: number; gainPercent: number }
interface MonthJson { month: number; zero: number; meta: number; faixas: FaixaJson[] }
interface IndJson { code: string; class: string; unid: string; peso: number; months: MonthJson[] }

async function main() {
  // ---------------------------------------------------------------------------
  // 0. Empresa + ator (super admin / dono)
  // ---------------------------------------------------------------------------
  let user = await prisma.user.findFirst({ where: { email: ADMIN_EMAIL, deletedAt: null } });
  if (!user) user = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN', deletedAt: null } });
  if (!user) throw new Error('Nenhum usuário administrador encontrado para usar como ator.');
  const companyId = process.env.SEED_COMPANY_ID ?? user.companyId;
  const actorId = user.id;
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new Error(`Empresa ${companyId} não encontrada.`);
  console.log(`\nEmpresa: ${company.name} (${companyId})`);
  console.log(`Ator:    ${user.email} [${user.role}]\n`);

  const audit = (action: string, entityType: string, entityId: string, after?: unknown, justification?: string) =>
    prisma.prizeAuditLog.create({
      data: { companyId, userId: actorId, userEmail: user!.email, action, entityType, entityId, after: (after as any) ?? undefined, justification: justification ?? null },
    });

  // ---------------------------------------------------------------------------
  // 1. Árvore organizacional: Área Agrícola > Setor Estradas (sem responsável)
  // ---------------------------------------------------------------------------
  console.log('== 1. Árvore organizacional ==');
  const root = await prisma.orgNode.findFirst({ where: { companyId, parentId: null, deletedAt: null }, orderBy: { position: 'asc' } });
  if (root) console.log(`  raiz existente: ${root.name} (${root.type})`);

  async function upsertOrgNode(name: string, type: OrgNodeType, parentId: string | null) {
    const existing = await prisma.orgNode.findFirst({ where: { companyId, name, deletedAt: null } });
    if (existing) { console.log(`  reusa nó: ${name} (${existing.type})`); return existing; }
    const created = await prisma.orgNode.create({ data: { companyId, name, type, parentId, active: true, responsibleUserId: null } });
    await audit('CREATE', 'ORG_NODE', created.id, created);
    console.log(`  + ${name} (${type})${parentId ? '' : ' [raiz]'}`);
    return created;
  }
  const areaAgricola = await upsertOrgNode('Área Agrícola', 'AREA', root?.id ?? null);
  const setorEstradas = await upsertOrgNode('Setor Estradas', 'SECTOR', areaAgricola.id);

  // ---------------------------------------------------------------------------
  // 2. Indicadores NATIVOS (módulo Visualizações) — donos = Setor Estradas
  // ---------------------------------------------------------------------------
  console.log('\n== 2. Indicadores nativos (Visualizações) ==');
  async function upsertIndicator(opts: {
    code: string; name: string; unit: IndicatorUnit; unitLabel?: string; direction: Direction;
  }) {
    const existing = await prisma.indicator.findFirst({ where: { companyId, code: opts.code, deletedAt: null } });
    if (existing) { console.log(`  reusa indicador: ${opts.code} — ${existing.name}`); return existing; }
    const created = await prisma.indicator.create({
      data: {
        companyId, ownerNodeId: setorEstradas.id, name: opts.name, code: opts.code,
        type: IndicatorType.OPERATIONAL, unit: opts.unit, unitLabel: opts.unitLabel ?? null,
        periodicity: Periodicity.MONTHLY, direction: opts.direction, feedKind: FeedKind.MANUAL,
        status: IndicatorStatus.ACTIVE, source: 'Prêmio Estradas - Anexo 0561',
      },
    });
    console.log(`  + ${opts.code} — ${opts.name} (${opts.direction})`);
    return created;
  }
  const nat22780 = await upsertIndicator({ code: '22780', name: '% CONF ISSMA - ESTRADAS', unit: IndicatorUnit.PERCENT, direction: Direction.HIGHER_BETTER });
  const nat32131 = await upsertIndicator({ code: '32131', name: 'Chamado Problema', unit: IndicatorUnit.QUANTITY, unitLabel: 'qtd', direction: Direction.LOWER_BETTER });

  // ---------------------------------------------------------------------------
  // 3. Apaga dados de TESTE do prêmio (limpa o módulo nesta empresa)
  // ---------------------------------------------------------------------------
  console.log('\n== 3. Apagando dados de teste do prêmio ==');
  const del = async (label: string, p: Promise<{ count: number }>) => { const r = await p; if (r.count) console.log(`  − ${label}: ${r.count}`); };
  await del('apurações (runs)', prisma.prizeCalculationRun.deleteMany({ where: { companyId } }));
  await del('espelhos', prisma.prizePayslip.deleteMany({ where: { companyId } }));
  await del('lotes folha', prisma.prizePayrollBatch.deleteMany({ where: { companyId } }));
  await del('realizados', prisma.prizeActualResult.deleteMany({ where: { companyId } }));
  await del('ajustes', prisma.prizeManualAdjustment.deleteMany({ where: { companyId } }));
  await del('exceções', prisma.prizeException.deleteMany({ where: { companyId } }));
  await del('transitoriedades', prisma.prizeTemporaryAllocation.deleteMany({ where: { companyId } }));
  await del('eventos elegível', prisma.prizeEmployeeEvent.deleteMany({ where: { companyId } }));
  await del('snapshots elegível', prisma.prizeEmployeeSnapshot.deleteMany({ where: { companyId } }));
  await del('jobs integração', prisma.prizeIntegrationJob.deleteMany({ where: { companyId } }));
  await del('conectores', prisma.prizeIntegrationConfig.deleteMany({ where: { companyId } }));
  await del('indicadores do prêmio (+faixas/params)', prisma.prizeIndicator.deleteMany({ where: { companyId } }));
  await prisma.prizeAnnex.updateMany({ where: { companyId }, data: { currentVersionId: null } });
  await del('anexos (+versões/aprovações)', prisma.prizeAnnex.deleteMany({ where: { companyId } }));
  await del('competências', prisma.prizeCompetence.deleteMany({ where: { companyId } }));
  await del('versões de programa', prisma.prizeProgramVersion.deleteMany({ where: { program: { companyId } } }));
  await del('programas', prisma.prizeProgram.deleteMany({ where: { companyId } }));
  await del('moderadores', prisma.prizeModeratorRule.deleteMany({ where: { companyId } }));
  await del('trilha de auditoria do prêmio', prisma.prizeAuditLog.deleteMany({ where: { companyId } }));
  console.log('  (limpeza concluída)');

  // ---------------------------------------------------------------------------
  // 4. Programa → Anexo 0561 → versão vigente → 12 competências
  // ---------------------------------------------------------------------------
  console.log('\n== 4. Programa, anexo e competências ==');
  const program = await prisma.prizeProgram.create({
    data: {
      companyId, orgNodeId: setorEstradas.id, code: 'PRM-ESTRADAS', name: 'Prêmio Estradas',
      description: 'Programa de remuneração variável — Estradas (anexo 0561).',
      periodicity: 'MONTHLY', currency: 'BRL', roundingRule: 'HALF_UP_2',
      validFrom: new Date('2026-01-01'), validTo: new Date('2026-12-31'), status: 'ACTIVE', createdById: actorId,
    },
  });
  await audit('CREATE', 'PROGRAM', program.id, program);
  console.log(`  + Programa ${program.code} — ${program.name}`);

  const annex = await prisma.prizeAnnex.create({
    data: {
      companyId, programId: program.id, code: '0561', name: 'Premio Estradas - Anexo - 0561',
      positionRef: 'Coordenador de Área', orgNodeId: setorEstradas.id,
      notes: 'Anexo oficial 0561 (Goiasa — Estradas). Cargo Coordenador de Área.', createdById: actorId,
    },
  });
  await audit('CREATE', 'ANNEX', annex.id, annex);

  // Versão 1: percorre o workflow (rascunho→validação→aprovação→aprovado→VIGENTE)
  const version = await prisma.prizeAnnexVersion.create({
    data: {
      annexId: annex.id, version: 1, status: 'EFFECTIVE',
      salaryPercent: 8.33, // % do salário possível do cargo (potencial total)
      effectiveFrom: new Date('2026-01-01'), effectiveTo: new Date('2026-12-31'),
      changeReason: 'Anexo 0561 — vigência 2026 (planilha oficial).',
      submittedAt: new Date(), approvedAt: new Date(), createdById: actorId,
    },
  });
  await prisma.prizeAnnexApproval.create({
    data: { annexVersionId: version.id, stepOrder: 1, approverUserId: actorId, status: 'APPROVED', comment: 'Aprovado conforme planilha oficial 0561.', decidedById: actorId, decidedAt: new Date() },
  });
  await prisma.prizeAnnex.update({ where: { id: annex.id }, data: { currentVersionId: version.id } });
  await audit('SUBMIT', 'ANNEX_VERSION', version.id, { status: 'IN_VALIDATION' });
  await audit('APPROVE', 'ANNEX_VERSION', version.id, { status: 'APPROVED' });
  await audit('PUBLISH', 'ANNEX_VERSION', version.id, { status: 'EFFECTIVE' });
  console.log(`  + Anexo ${annex.code} v${version.version} VIGENTE (salário possível 8,33%)`);

  for (let m = 1; m <= 12; m++) {
    const label = `2026-${String(m).padStart(2, '0')}`;
    await prisma.prizeCompetence.create({
      data: {
        companyId, programId: program.id, year: 2026, month: m, label, status: 'OPEN',
        startDate: new Date(Date.UTC(2026, m - 1, 1)), endDate: new Date(Date.UTC(2026, m, 0)), createdById: actorId,
      },
    });
  }
  console.log('  + 12 competências (2026-01 … 2026-12)');

  // ---------------------------------------------------------------------------
  // 5. Indicadores do prêmio (peso 50) + parâmetros mensais + faixas
  // ---------------------------------------------------------------------------
  console.log('\n== 5. Indicadores do prêmio, parâmetros e faixas ==');
  const dataPath = path.join(__dirname, 'data', 'prize-estradas-0561.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8')) as Record<string, IndJson>;

  async function wireIndicator(nativeId: string, code: string, name: string, dir: string, unit: string, json: IndJson, monthly: boolean) {
    const pind = await prisma.prizeIndicator.create({
      data: {
        companyId, programId: program.id, annexVersionId: version.id, platformIndicatorId: nativeId,
        code, name, kind: 'COLLECTIVE', direction: dir as any, unit, weight: 50,
        source: 'INTERNAL_API', status: 'ACTIVE', createdById: actorId,
      },
    });

    let paramCount = 0;
    let rangeCount = 0;
    if (!monthly) {
      // 22780: zero/meta e faixas FIXOS o ano todo → 1 parâmetro anual (mês nulo)
      const mjan = json.months[0];
      const param = await prisma.prizeIndicatorParameter.create({
        data: { indicatorId: pind.id, year: 2026, month: null, target: mjan.meta, zero: mjan.zero, weight: 50, changeReason: 'Anexo 0561 (fixo 2026)', createdById: actorId },
      });
      paramCount++;
      for (const f of mjan.faixas) {
        await prisma.prizeIndicatorRange.create({
          data: { indicatorId: pind.id, parameterId: param.id, orderIndex: f.orderIndex, minLimit: f.minLimit, maxLimit: f.maxLimit, achievementPercent: f.gainPercent, gainPercent: f.gainPercent },
        });
        rangeCount++;
      }
    } else {
      // 32131: zero/meta e faixas MUDAM por mês → 1 parâmetro + 6 faixas por mês
      for (const mo of json.months) {
        const param = await prisma.prizeIndicatorParameter.create({
          data: { indicatorId: pind.id, year: 2026, month: mo.month, target: mo.meta, zero: mo.zero, weight: 50, changeReason: `Anexo 0561 (mês ${mo.month})`, createdById: actorId },
        });
        paramCount++;
        for (const f of mo.faixas) {
          await prisma.prizeIndicatorRange.create({
            data: { indicatorId: pind.id, parameterId: param.id, orderIndex: f.orderIndex, minLimit: f.minLimit, maxLimit: f.maxLimit, achievementPercent: f.gainPercent, gainPercent: f.gainPercent },
          });
          rangeCount++;
        }
      }
    }
    await audit('CREATE', 'INDICATOR', pind.id, { code, weight: 50, platformIndicatorId: nativeId });
    console.log(`  + ${code} — ${name} (peso 50%, ${paramCount} parâmetro(s), ${rangeCount} faixa(s))`);
  }

  await wireIndicator(nat22780.id, '22780', '% CONF ISSMA - ESTRADAS', 'HIGHER_BETTER', '%', data['22780'], false);
  await wireIndicator(nat32131.id, '32131', 'Chamado Problema', 'LOWER_BETTER', 'qtd', data['32131'], true);

  // ---------------------------------------------------------------------------
  // 6. Moderadores do modelo oficial (editáveis)
  // ---------------------------------------------------------------------------
  console.log('\n== 6. Moderadores (modelo oficial) ==');
  const MODS = [
    { name: 'Falta (modelo oficial)', eventType: 'FALTA', criterion: 'PER_DAY', reductionPercent: 34, notes: 'Planilha CALCULO: 34% por dia de falta' },
    { name: 'Suspensão (modelo oficial)', eventType: 'SUSPENSAO', criterion: 'PER_DAY', reductionPercent: 34, notes: 'Planilha CALCULO: 34% por dia de suspensão' },
    { name: 'Medida disciplinar (modelo oficial)', eventType: 'MEDIDA_DISCIPLINAR', criterion: 'PER_OCCURRENCE', reductionPercent: 50, notes: 'Planilha CALCULO: 50% por medida (advertência verbal não conta)' },
    { name: 'Acidente com afastamento (modelo oficial)', eventType: 'ACIDENTE', criterion: 'PER_OCCURRENCE', reductionPercent: 50, notes: 'Planilha CALCULO: 50% por acidente com afastamento' },
    { name: 'Atestado (modelo oficial)', eventType: 'ATESTADO', criterion: 'PER_DAY_AFTER_FIRST', reductionPercent: 20, notes: 'Planilha CALCULO/DatasAtestados: 20% por dia, 1º atestado abonado' },
  ];
  for (const md of MODS) {
    const r = await prisma.prizeModeratorRule.create({ data: { companyId, ...md, cumulative: true, priority: 0, requiresApproval: false, active: true, createdById: actorId } });
    await audit('CREATE', 'MODERATOR_RULE', r.id, r, 'Seed modelo oficial');
  }
  console.log(`  + ${MODS.length} regras de moderador`);

  // ---------------------------------------------------------------------------
  // Resumo
  // ---------------------------------------------------------------------------
  const counts = {
    programas: await prisma.prizeProgram.count({ where: { companyId } }),
    anexos: await prisma.prizeAnnex.count({ where: { companyId } }),
    competencias: await prisma.prizeCompetence.count({ where: { companyId } }),
    indicadoresPremio: await prisma.prizeIndicator.count({ where: { companyId } }),
    parametros: await prisma.prizeIndicatorParameter.count({ where: { indicator: { companyId } } }),
    faixas: await prisma.prizeIndicatorRange.count({ where: { indicator: { companyId } } }),
    moderadores: await prisma.prizeModeratorRule.count({ where: { companyId } }),
  };
  console.log('\n== RESUMO ==');
  console.log(JSON.stringify(counts, null, 2));
  console.log('\n✓ População do anexo 0561 concluída.');
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => { console.error('\n✗ ERRO:', e); await prisma.$disconnect(); process.exit(1); });
