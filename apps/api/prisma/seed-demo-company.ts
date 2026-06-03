/**
 * Seed da EMPRESA DEMONSTRAÇÃO — clona a ESTRUTURA da Goiasa com dados FICTÍCIOS.
 *
 * - Espelha a forma da Goiasa (hierarquia, qtde/tipo de indicadores, esqueleto do mapa
 *   estratégico) mas com rótulos fictícios temáticos (usina sucroenergética) e valores
 *   numéricos aleatórios. Não copia nenhum texto real da Goiasa.
 * - Goiasa é SOMENTE LEITURA (nunca modificada). Toda escrita/deleção é escopada ao
 *   companyId da Empresa Demonstração (com guarda explícita).
 * - Idempotente: a cada execução LIMPA os dados da Empresa Demonstração e regenera.
 *
 * Rodar:  pnpm -C apps/api exec tsx prisma/seed-demo-company.ts
 */
import { PrismaClient, UserRoleEnum, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { calcStatus } from '@g360/shared';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Demo@2026!';
const DEMO_DOMAIN = '@demonstracao.local';

// ---------- helpers ----------
const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const rint = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const rfloat = (min: number, max: number) => Math.random() * (max - min) + min;
const round2 = (n: number) => Math.round(n * 100) / 100;
const chance = (p: number) => Math.random() < p;

/** Gera nomes únicos a partir de um pool (acrescenta sufixo se esgotar). */
function namer(pool: string[]) {
  let i = 0;
  const used = new Set<string>();
  return () => {
    let name = pool[i % pool.length];
    if (i >= pool.length) name = `${name} ${Math.floor(i / pool.length) + 1}`;
    i += 1;
    while (used.has(name)) name = `${name} ${rint(2, 99)}`;
    used.add(name);
    return name;
  };
}

// ---------- catálogos fictícios (tema: usina de etanol/açúcar) ----------
const SECTOR_POOL = ['Industrial', 'Administrativo', 'Operações', 'Apoio Técnico'];
const AREA_POOL = [
  'Moagem', 'Destilaria', 'Fermentação', 'Caldeiras e Utilidades', 'Laboratório',
  'Manutenção Industrial', 'Meio Ambiente', 'Qualidade', 'Logística e Expedição',
  'Agrícola (CCT)', 'Recursos Humanos', 'Segurança do Trabalho', 'Automação', 'Tratamento de Caldo',
];
const IND_PERCENT_HIGH = [
  'Eficiência de Moagem', 'Rendimento de Fermentação', 'OEE da Moenda', 'Disponibilidade de Equipamentos',
  'Conformidade Ambiental', 'Aproveitamento de ATR', 'Eficiência de Caldeira', 'Conformidade ISSMA',
  'Atendimento de Vagas no Prazo', 'Satisfação Interna', 'Índice de Treinamento', 'Conformidade de Limpeza',
];
const IND_PERCENT_LOW = [
  'Absenteísmo', 'Turnover', 'Taxa de Retrabalho', 'Índice de Perdas', 'Taxa de Reclamações',
  'Taxa de Frequência de Acidentes', 'Paradas por Falha',
];
const IND_QTY = [
  'Produção de Etanol', 'Produção de Açúcar', 'Moagem de Cana', 'Geração de Energia', 'Consumo de Vapor',
  'Paradas Não Programadas', 'Acidentes com Afastamento', 'Ocorrências de Incêndio', 'Horas de Manutenção',
];
const OBJECTIVE_POOL = [
  'Aumentar a eficiência operacional', 'Reduzir o custo de produção', 'Zerar acidentes de trabalho',
  'Elevar a satisfação dos clientes', 'Desenvolver competências da equipe', 'Reduzir o impacto ambiental',
  'Maximizar o aproveitamento de ATR', 'Aumentar a disponibilidade dos ativos', 'Melhorar a qualidade do produto',
  'Otimizar a logística de expedição', 'Fortalecer a cultura de segurança', 'Ampliar a produtividade agrícola',
  'Modernizar o parque industrial', 'Reduzir perdas de processo', 'Aumentar a geração de energia',
];
const FIRST_NAMES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Eduarda', 'Felipe', 'Gabriela', 'Henrique', 'Isabela', 'João', 'Karina', 'Lucas', 'Mariana', 'Nelson', 'Otávio', 'Patrícia', 'Rafael', 'Sabrina', 'Thiago', 'Vanessa'];
const LAST_NAMES = ['Silva', 'Souza', 'Oliveira', 'Santos', 'Pereira', 'Lima', 'Costa', 'Almeida', 'Ferreira', 'Rodrigues', 'Gomes', 'Martins', 'Araújo', 'Barbosa', 'Ribeiro', 'Carvalho'];
const JOB_POOL = [
  'Operador de Processo', 'Técnico de Manutenção', 'Analista de Qualidade', 'Supervisor de Produção',
  'Engenheiro Agrônomo', 'Auxiliar Administrativo', 'Técnico de Segurança', 'Analista de RH',
  'Coordenador Industrial', 'Operador de Caldeira', 'Técnico de Laboratório', 'Encarregado de Logística',
  'Eletricista Industrial', 'Mecânico Industrial',
];
const PROJECT_POOL = ['Modernização da Moenda', 'Automação da Destilaria', 'Eficiência Energética', 'Redução de Perdas de ATR', 'Programa de Segurança Comportamental', 'Expansão da Cogeração'];
const MEETING_POOL = ['Reunião de Análise de Indicadores', 'Comitê de Produção', 'Reunião de Segurança', 'Análise Crítica de Desvios', 'Reunião de Resultados Mensais'];
const ACTION_POOL = ['Plano de redução de perdas', 'Ação corretiva de manutenção', 'Melhoria de eficiência operacional', 'Plano de capacitação da equipe', 'Ação de conformidade ambiental', 'Plano de redução de paradas', 'Ação de melhoria de qualidade', 'Plano de segurança comportamental'];
const DEVIATION_POOL = ['Desvio de meta de produção', 'Não conformidade ambiental', 'Desvio de eficiência de moagem', 'Parada não programada de equipamento', 'Desvio de meta de segurança', 'Desvio de qualidade do produto'];
const SIX_M = ['Método', 'Máquina', 'Mão de obra', 'Material', 'Medida', 'Meio ambiente'];

function randomName() {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

// alvo plausível por unidade/direção
function baseTarget(unit: string, direction: string): number {
  switch (unit) {
    case 'PERCENT':
      return direction === 'LOWER_BETTER' ? rfloat(2, 12) : rfloat(85, 98);
    case 'CURRENCY':
      return rfloat(50_000, 800_000);
    case 'TONS':
      return rfloat(800, 6000);
    case 'LITERS':
      return rfloat(5000, 60_000);
    case 'HOURS':
      return rfloat(20, 220);
    case 'DAYS':
      return rfloat(1, 30);
    case 'INDEX':
      return rfloat(0.6, 1.4);
    case 'QUANTITY':
    default:
      return rfloat(50, 2000);
  }
}

function lastMonths(n: number): { periodRef: string; periodDate: Date }[] {
  const out: { periodRef: string; periodDate: Date }[] = [];
  const now = new Date();
  for (let k = n - 1; k >= 0; k--) {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
    const periodRef = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push({ periodRef, periodDate: d });
  }
  return out;
}

function isoWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

async function main() {
  // 1) Resolver empresas + guarda de segurança
  const companies = await prisma.company.findMany({ where: { deletedAt: null }, select: { id: true, name: true } });
  const demo = companies.find((c) => /demonstra/i.test(c.name));
  const goiasa = companies.find((c) => /goiasa|goaisa/i.test(c.name));
  if (!demo) throw new Error('Empresa Demonstração não encontrada.');
  if (!goiasa) throw new Error('Empresa Goiasa não encontrada.');
  if (demo.id === goiasa.id) throw new Error('GUARD: demo == goiasa, abortando.');
  if (!/demonstra/i.test(demo.name)) throw new Error('GUARD: alvo não é a Empresa Demonstração, abortando.');
  const companyId = demo.id;
  console.log(`Alvo (escrita): ${demo.name} [${companyId}]`);
  console.log(`Origem (leitura): ${goiasa.name} [${goiasa.id}]`);

  const goiasaBefore = await snapshot(goiasa.id);

  // 2) WIPE (escopo demo) — filhos antes de pais; usuários demo são preservados (upsert depois)
  console.log('Limpando dados anteriores da Empresa Demonstração...');
  await prisma.userVisibilityException.deleteMany({ where: { companyId } });
  await prisma.areaVisibilityRule.deleteMany({ where: { companyId } });
  await prisma.userAreaAssignment.deleteMany({ where: { companyId } });
  await prisma.actionPlan.deleteMany({ where: { companyId } }); // cascata tasks
  await prisma.project.deleteMany({ where: { companyId } }); // cascata milestones/tasks
  await prisma.meeting.deleteMany({ where: { companyId } }); // cascata participants/agenda/decisions
  await prisma.oKRCycle.deleteMany({ where: { companyId } }); // cascata objetivos/KR/checkins
  await prisma.deviation.deleteMany({ where: { companyId } }); // cascata causes/analyses
  await prisma.indicator.deleteMany({ where: { companyId } }); // cascata targets/results/objIndicator
  await prisma.strategicMap.deleteMany({ where: { companyId } }); // cascata perspectives/objectives/links/relations
  await prisma.orgEmployee.deleteMany({ where: { companyId } });
  await prisma.orgJob.deleteMany({ where: { companyId } });
  await prisma.user.updateMany({ where: { companyId }, data: { defaultNodeId: null } });
  await prisma.orgNode.updateMany({ where: { companyId }, data: { parentId: null } });
  await prisma.orgNode.deleteMany({ where: { companyId } });
  await prisma.branch.deleteMany({ where: { companyId } });

  // 3) Branch
  const branch = await prisma.branch.create({
    data: { companyId, name: 'Unidade Demonstração', code: 'UD-01', city: 'Goiatuba', state: 'GO', active: true },
    select: { id: true },
  });

  // 4) Org tree (espelha tipos/hierarquia da Goiasa)
  const goNodes = await prisma.orgNode.findMany({
    where: { companyId: goiasa.id, deletedAt: null },
    select: { id: true, type: true, parentId: true, position: true },
    orderBy: { position: 'asc' },
  });
  const sectorName = namer(SECTOR_POOL);
  const areaName = namer(AREA_POOL);
  const nodeMap = new Map<string, string>();
  // cria em 2 passadas para resolver parentId (pais primeiro por ausência de parent)
  const ordered = [...goNodes].sort((a, b) => Number(!!a.parentId) - Number(!!b.parentId));
  for (const n of ordered) {
    const name =
      n.type === 'BRANCH' ? 'Unidade Demonstração'
        : n.type === 'SECTOR' ? sectorName()
        : n.type === 'AREA' ? areaName()
        : `Estrutura ${n.position || rint(1, 99)}`;
    const created = await prisma.orgNode.create({
      data: {
        companyId,
        branchId: branch.id,
        parentId: n.parentId ? nodeMap.get(n.parentId) ?? null : null,
        name,
        type: n.type,
        position: n.position,
        active: true,
        color: pick(['#2563eb', '#16a34a', '#d97706', '#7c3aed', '#dc2626', '#0891b2']),
      },
      select: { id: true },
    });
    nodeMap.set(n.id, created.id);
  }
  const areaIds = [...nodeMap.values()];

  // 5) Usuários demo (upsert por email) + atribuição de área PRIMARY
  const rounds = parseInt(process.env.BCRYPT_ROUNDS ?? '10', 10);
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, rounds);
  const profileByRole = async (role: UserRoleEnum) =>
    (await prisma.accessProfile.findFirst({ where: { role }, select: { id: true } }))?.id ?? null;

  const demoUserDefs: { email: string; name: string; role: UserRoleEnum }[] = [
    { email: `admin.demo${DEMO_DOMAIN}`, name: 'Administrador Demonstração', role: UserRoleEnum.COMPANY_ADMIN },
    { email: `diretor.demo${DEMO_DOMAIN}`, name: 'Diego Diretor', role: UserRoleEnum.DIRECTOR },
    { email: `gestor.demo${DEMO_DOMAIN}`, name: 'Gabriela Gestora', role: UserRoleEnum.MANAGER },
    { email: `analista.demo${DEMO_DOMAIN}`, name: 'Ana Analista', role: UserRoleEnum.ANALYST },
    { email: `visualizador.demo${DEMO_DOMAIN}`, name: 'Victor Visual', role: UserRoleEnum.VIEWER },
  ];
  const demoUsers: { id: string; role: UserRoleEnum }[] = [];
  for (let i = 0; i < demoUserDefs.length; i++) {
    const def = demoUserDefs[i];
    const areaId = areaIds[i % areaIds.length];
    const accessProfileId = await profileByRole(def.role);
    const u = await prisma.user.upsert({
      where: { email: def.email },
      create: {
        companyId, email: def.email, name: def.name, passwordHash, role: def.role,
        status: 'ACTIVE', active: true, branchId: branch.id, defaultNodeId: areaId, accessProfileId,
        jobTitle: def.role === UserRoleEnum.COMPANY_ADMIN ? 'Administrador' : def.name.split(' ')[1] ?? 'Equipe',
      },
      update: {
        companyId, name: def.name, passwordHash, role: def.role, status: 'ACTIVE', active: true,
        branchId: branch.id, defaultNodeId: areaId, accessProfileId, activeCompanyId: null,
      },
      select: { id: true, role: true },
    });
    await prisma.userAreaAssignment.upsert({
      where: { userId_orgNodeId: { userId: u.id, orgNodeId: areaId } },
      create: { userId: u.id, companyId, orgNodeId: areaId, assignmentType: 'PRIMARY', isPrimary: true },
      update: { assignmentType: 'PRIMARY', isPrimary: true, companyId },
    });
    demoUsers.push(u);
  }
  const userIds = demoUsers.map((u) => u.id);

  // 6) Indicadores (espelha unit/direction/periodicity da Goiasa; nome temático compatível)
  const goInds = await prisma.indicator.findMany({
    where: { companyId: goiasa.id, deletedAt: null },
    select: { id: true, ownerNodeId: true, type: true, unit: true, direction: true, periodicity: true, weight: true, yellowToleranceP: true },
  });
  const pctHigh = namer(IND_PERCENT_HIGH);
  const pctLow = namer(IND_PERCENT_LOW);
  const qty = namer(IND_QTY);
  const indMap = new Map<string, string>();
  const demoIndicators: { id: string; unit: string; direction: string; periodicity: string; yellowToleranceP: number }[] = [];
  let indSeq = 0;
  for (const ind of goInds) {
    indSeq += 1;
    const name =
      ind.unit === 'PERCENT'
        ? ind.direction === 'LOWER_BETTER' ? pctLow() : pctHigh()
        : qty();
    const ownerNodeId = nodeMap.get(ind.ownerNodeId) ?? pick(areaIds);
    const created = await prisma.indicator.create({
      data: {
        companyId, ownerNodeId, name, code: `IND-${String(indSeq).padStart(3, '0')}`,
        type: ind.type, unit: ind.unit, direction: ind.direction, periodicity: ind.periodicity,
        weight: ind.weight, yellowToleranceP: ind.yellowToleranceP,
        responsibleUserId: pick(userIds), feederUserId: pick(userIds), status: 'ACTIVE',
        description: `Indicador de demonstração (${name}).`,
      },
      select: { id: true },
    });
    indMap.set(ind.id, created.id);
    demoIndicators.push({ id: created.id, unit: ind.unit, direction: ind.direction, periodicity: ind.periodicity, yellowToleranceP: ind.yellowToleranceP });
  }

  // 7) Metas + Resultados (12 meses)
  const months = lastMonths(12);
  for (const ind of demoIndicators) {
    const base = baseTarget(ind.unit, ind.direction);
    const targets: Prisma.IndicatorTargetCreateManyInput[] = [];
    const results: Prisma.IndicatorResultCreateManyInput[] = [];
    for (const m of months) {
      const target = round2(base * rfloat(0.95, 1.05));
      // realizado com ruído; ocasionalmente "estoura" para gerar mix de farol
      const noise = rfloat(-0.18, 0.18);
      const value = round2(Math.max(0, target * (1 + noise)));
      const st = calcStatus({
        value, target,
        direction: ind.direction as any,
        yellowToleranceP: ind.yellowToleranceP,
      });
      targets.push({ indicatorId: ind.id, periodRef: m.periodRef, target });
      results.push({
        indicatorId: ind.id, periodRef: m.periodRef, periodDate: m.periodDate, value,
        status: 'APPROVED', light: st.light as any,
        attainment: st.attainment, deviationAbs: st.deviationAbs, deviationPct: st.deviationPct,
        createdById: pick(userIds),
      });
    }
    await prisma.indicatorTarget.createMany({ data: targets, skipDuplicates: true });
    await prisma.indicatorResult.createMany({ data: results, skipDuplicates: true });
  }

  // 8) Mapa estratégico (espelha mapas/perspectivas/objetivos da Goiasa)
  const goMaps = await prisma.strategicMap.findMany({ where: { companyId: goiasa.id, deletedAt: null }, select: { id: true, startsAt: true, endsAt: true, active: true } });
  const goPersp = await prisma.perspective.findMany({ where: { map: { companyId: goiasa.id } }, select: { id: true, mapId: true, kind: true, position: true, positionX: true, positionY: true, width: true, height: true } });
  const goObjs = await prisma.strategicObjective.findMany({ where: { map: { companyId: goiasa.id } }, select: { id: true, mapId: true, perspectiveId: true, ownerNodeId: true, weight: true, status: true, priority: true, position: true, positionX: true, positionY: true, width: true, height: true } });
  const goObjInd = await prisma.strategicObjectiveIndicator.findMany({ where: { objective: { map: { companyId: goiasa.id } } }, select: { objectiveId: true, indicatorId: true } });
  const goObjNode = await prisma.strategicObjectiveOrgNode.findMany({ where: { objective: { map: { companyId: goiasa.id } } }, select: { objectiveId: true, orgNodeId: true, kind: true } });
  const goObjRel = await prisma.objectiveRelation.findMany({ where: { from: { map: { companyId: goiasa.id } } }, select: { fromId: true, toId: true, weight: true, kind: true, label: true } });

  const mapMap = new Map<string, string>();
  const perspMap = new Map<string, string>();
  const objMap = new Map<string, string>();
  const objName = namer(OBJECTIVE_POOL);
  const PERSP_LABEL: Record<string, string> = {
    FINANCIAL: 'Financeira', CUSTOMERS: 'Clientes', INTERNAL_PROCESS: 'Processos Internos',
    LEARNING_GROWTH: 'Aprendizado e Crescimento', SAFETY: 'Segurança', PEOPLE: 'Pessoas',
    ESG: 'Sustentabilidade (ESG)', QUALITY: 'Qualidade', PRODUCTIVITY: 'Produtividade',
    COSTS: 'Custos', CUSTOM: 'Perspectiva',
  };

  let mapSeq = 0;
  for (const gm of goMaps) {
    mapSeq += 1;
    const map = await prisma.strategicMap.create({
      data: {
        companyId, name: mapSeq === 1 ? 'Mapa Estratégico (Demonstração)' : `Mapa Estratégico ${mapSeq} (Demonstração)`,
        description: 'Mapa estratégico fictício para demonstração.',
        startsAt: gm.startsAt, endsAt: gm.endsAt, active: gm.active,
      },
      select: { id: true },
    });
    mapMap.set(gm.id, map.id);
  }
  for (const gp of goPersp) {
    const newMapId = mapMap.get(gp.mapId);
    if (!newMapId) continue;
    const p = await prisma.perspective.create({
      data: {
        mapId: newMapId, kind: gp.kind, name: PERSP_LABEL[gp.kind] ?? 'Perspectiva',
        position: gp.position, positionX: gp.positionX, positionY: gp.positionY, width: gp.width, height: gp.height,
      },
      select: { id: true },
    });
    perspMap.set(gp.id, p.id);
  }
  for (const go of goObjs) {
    const newMapId = mapMap.get(go.mapId);
    const newPerspId = perspMap.get(go.perspectiveId);
    if (!newMapId || !newPerspId) continue;
    const o = await prisma.strategicObjective.create({
      data: {
        mapId: newMapId, perspectiveId: newPerspId, name: objName(),
        ownerNodeId: go.ownerNodeId ? nodeMap.get(go.ownerNodeId) ?? null : null,
        responsibleUserId: chance(0.8) ? pick(userIds) : null,
        weight: go.weight, status: go.status, priority: go.priority,
        position: go.position, positionX: go.positionX, positionY: go.positionY, width: go.width, height: go.height,
      },
      select: { id: true },
    });
    objMap.set(go.id, o.id);
  }
  // links objetivo<->indicador
  for (const l of goObjInd) {
    const objectiveId = objMap.get(l.objectiveId);
    const indicatorId = indMap.get(l.indicatorId);
    if (!objectiveId || !indicatorId) continue;
    await prisma.strategicObjectiveIndicator.create({ data: { objectiveId, indicatorId } }).catch(() => undefined);
  }
  // links objetivo<->área
  for (const l of goObjNode) {
    const objectiveId = objMap.get(l.objectiveId);
    const orgNodeId = nodeMap.get(l.orgNodeId);
    if (!objectiveId || !orgNodeId) continue;
    await prisma.strategicObjectiveOrgNode.create({ data: { objectiveId, orgNodeId, kind: l.kind } }).catch(() => undefined);
  }
  // relações entre objetivos
  for (const r of goObjRel) {
    const fromId = objMap.get(r.fromId);
    const toId = objMap.get(r.toId);
    if (!fromId || !toId || fromId === toId) continue;
    await prisma.objectiveRelation.create({ data: { fromId, toId, weight: r.weight, kind: r.kind, label: r.label } }).catch(() => undefined);
  }

  // ---------- atividade (gerada num volume saudável p/ demo) ----------
  const allIndIds = demoIndicators.map((i) => i.id);
  const allObjIds = [...objMap.values()];

  // 9) Planos de ação
  const actionTitle = namer(ACTION_POOL);
  const ACTION_STATUS = ['NOT_STARTED', 'IN_PROGRESS', 'IN_PROGRESS', 'WAITING_EVIDENCE', 'DONE', 'DONE'] as const;
  const PRIORITY = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
  for (let i = 0; i < 8; i++) {
    const status = pick([...ACTION_STATUS]);
    const start = new Date(Date.now() - rint(10, 120) * 86_400_000);
    const due = new Date(start.getTime() + rint(15, 90) * 86_400_000);
    const action = await prisma.actionPlan.create({
      data: {
        companyId, branchId: branch.id, ownerNodeId: pick(areaIds), responsibleUserId: pick(userIds), createdById: pick(userIds),
        indicatorId: chance(0.8) ? pick(allIndIds) : null,
        strategicObjectiveId: allObjIds.length && chance(0.5) ? pick(allObjIds) : null,
        title: actionTitle(), description: 'Plano de ação fictício para demonstração.',
        origin: 'MANUAL', priority: pick([...PRIORITY]), criticality: pick([...PRIORITY]),
        status, startDate: start, dueDate: due,
        completedAt: status === 'DONE' ? due : null,
        progress: status === 'DONE' ? 100 : status === 'NOT_STARTED' ? 0 : rint(20, 80),
      },
      select: { id: true },
    });
    const taskCount = rint(2, 4);
    for (let t = 0; t < taskCount; t++) {
      await prisma.actionTask.create({
        data: {
          actionId: action.id, title: `Etapa ${t + 1}: ${pick(['levantamento', 'execução', 'verificação', 'padronização'])}`,
          done: status === 'DONE' || chance(0.4), assignedToId: pick(userIds), position: t,
          dueDate: new Date(start.getTime() + (t + 1) * rint(3, 15) * 86_400_000),
        },
      });
    }
  }

  // 10) Desvios
  const devTitle = namer(DEVIATION_POOL);
  const DEV_SEV = ['LOW', 'MODERATE', 'CRITICAL'] as const;
  const DEV_STATUS = ['OPEN', 'IN_ANALYSIS', 'WAITING_ACTION', 'IN_PROGRESS', 'CLOSED'] as const;
  for (let i = 0; i < 6; i++) {
    const dev = await prisma.deviation.create({
      data: {
        companyId, indicatorId: pick(allIndIds), periodRef: pick(months).periodRef, number: i + 1,
        title: devTitle(), severity: pick([...DEV_SEV]), status: pick([...DEV_STATUS]), method: 'FCA',
        fact: 'Resultado abaixo da meta no período (dados fictícios).',
        impact: pick(['Baixo impacto operacional.', 'Impacto moderado na produção.', 'Risco à meta mensal.']),
        responsibleUserId: pick(userIds), openedAt: new Date(Date.now() - rint(5, 90) * 86_400_000),
      },
      select: { id: true },
    });
    const causeCount = rint(1, 3);
    for (let c = 0; c < causeCount; c++) {
      await prisma.deviationCause.create({ data: { deviationId: dev.id, category: pick(SIX_M), description: 'Causa potencial identificada (fictícia).', weight: rfloat(0.5, 1) } });
    }
    await prisma.deviationAnalysis.create({ data: { deviationId: dev.id, method: 'FCA', content: 'Análise de causa fictícia para demonstração.' } });
  }

  // 11) Reuniões
  const meetTitle = namer(MEETING_POOL);
  const MEET_KIND = ['INDICATORS', 'BOARD', 'SECTOR', 'PROJECT', 'DEVIATION'] as const;
  for (let i = 0; i < 4; i++) {
    const startsAt = new Date(Date.now() - rint(0, 40) * 86_400_000 + rint(8, 17) * 3_600_000);
    const meeting = await prisma.meeting.create({
      data: {
        companyId, title: meetTitle(), kind: pick([...MEET_KIND]), format: pick(['PRESENTIAL', 'ONLINE', 'HYBRID'] as const),
        status: pick(['SCHEDULED', 'COMPLETED'] as const), startsAt, endsAt: new Date(startsAt.getTime() + 3_600_000),
        location: pick(['Sala de Reuniões', 'Auditório', 'Online (Teams)']), responsibleUserId: pick(userIds),
        objective: 'Acompanhar indicadores e planos de ação (demonstração).', indicatorId: chance(0.6) ? pick(allIndIds) : null,
      },
      select: { id: true },
    });
    const parts = [...new Set([pick(userIds), pick(userIds), pick(userIds)])];
    for (const uid of parts) {
      await prisma.meetingParticipant.create({ data: { meetingId: meeting.id, userId: uid, role: 'PARTICIPANT', attended: chance(0.8) } }).catch(() => undefined);
    }
    for (let a = 0; a < rint(2, 4); a++) {
      await prisma.meetingAgendaItem.create({ data: { meetingId: meeting.id, topic: pick(['Resultados do mês', 'Planos de ação em andamento', 'Desvios críticos', 'Próximos passos']), position: a } });
    }
    await prisma.meetingDecision.create({ data: { meetingId: meeting.id, decision: 'Manter acompanhamento semanal dos indicadores.', owner: randomName(), dueDate: new Date(startsAt.getTime() + 7 * 86_400_000) } });
  }

  // 12) OKRs
  const year = new Date().getFullYear();
  const cycle = await prisma.oKRCycle.create({
    data: { companyId, name: `Ciclo ${year}`, startsAt: new Date(year, 0, 1), endsAt: new Date(year, 11, 31), active: true },
    select: { id: true },
  });
  const okrObjName = namer(OBJECTIVE_POOL);
  for (let i = 0; i < 5; i++) {
    const obj = await prisma.oKRObjective.create({
      data: {
        cycleId: cycle.id, name: okrObjName(), description: 'Objetivo OKR fictício.',
        ownerName: randomName(), team: pick(['Industrial', 'Agrícola', 'Administrativo']),
        confidence: rfloat(0.4, 0.9), status: pick(['PLANNED', 'ON_TRACK', 'AT_RISK'] as const),
        strategicObjId: allObjIds.length && chance(0.6) ? pick(allObjIds) : null,
      },
      select: { id: true },
    });
    for (let k = 0; k < rint(2, 3); k++) {
      const startValue = rfloat(0, 30);
      const targetValue = startValue + rfloat(20, 70);
      await prisma.keyResult.create({
        data: {
          objectiveId: obj.id, metric: pick(['% de conclusão', 'Índice de eficiência', 'Nº de melhorias', 'Redução de perdas (%)']),
          unit: pick(['PERCENT', 'QUANTITY', 'INDEX'] as const), startValue: round2(startValue),
          currentValue: round2(rfloat(startValue, targetValue)), targetValue: round2(targetValue),
          direction: 'HIGHER_BETTER', responsible: randomName(),
        },
      });
    }
    for (let c = 0; c < rint(1, 2); c++) {
      await prisma.oKRCheckin.create({
        data: { objectiveId: obj.id, weekRef: isoWeek(new Date(Date.now() - c * 7 * 86_400_000)), confidence: rfloat(0.4, 0.9), progress: rfloat(0.1, 0.9), note: 'Check-in fictício.' },
      });
    }
  }

  // 13) Projetos
  const projName = namer(PROJECT_POOL);
  for (let i = 0; i < 3; i++) {
    const startsAt = new Date(Date.now() - rint(30, 180) * 86_400_000);
    const project = await prisma.project.create({
      data: {
        companyId, name: projName(), description: 'Projeto fictício para demonstração.',
        status: pick(['PLANNED', 'IN_PROGRESS', 'IN_PROGRESS', 'DONE'] as const),
        startsAt, endsAt: new Date(startsAt.getTime() + rint(60, 240) * 86_400_000),
        responsible: randomName(), budget: round2(rfloat(50_000, 2_000_000)),
        indicatorId: chance(0.6) ? pick(allIndIds) : null,
      },
      select: { id: true },
    });
    for (let m = 0; m < rint(2, 4); m++) {
      await prisma.projectMilestone.create({ data: { projectId: project.id, name: `Marco ${m + 1}`, dueDate: new Date(startsAt.getTime() + (m + 1) * rint(20, 45) * 86_400_000), done: chance(0.5) } });
    }
    let prevTask: string | null = null;
    for (let t = 0; t < rint(3, 5); t++) {
      const task: { id: string } = await prisma.projectTask.create({
        data: {
          projectId: project.id, name: `Tarefa ${t + 1}`, startDate: new Date(startsAt.getTime() + t * 10 * 86_400_000),
          endDate: new Date(startsAt.getTime() + (t + 1) * 10 * 86_400_000), progress: rint(0, 100),
          responsible: randomName(), dependencyId: prevTask, position: t,
        },
        select: { id: true },
      });
      prevTask = task.id;
    }
  }

  // 14) Cargos e colaboradores
  const jobName = namer([...JOB_POOL]);
  const jobIds: string[] = [];
  for (let i = 0; i < JOB_POOL.length; i++) {
    const job = await prisma.orgJob.create({ data: { companyId, name: jobName(), description: 'Cargo fictício para demonstração.', active: true }, select: { id: true } });
    jobIds.push(job.id);
  }
  for (let i = 0; i < 31; i++) {
    await prisma.orgEmployee.create({
      data: {
        companyId, orgNodeId: pick(areaIds), name: randomName(), registrationId: `MAT-${String(1000 + i)}`,
        jobId: pick(jobIds), band: pick(['A', 'B', 'C', 'D']), shift: pick(['A', 'B', 'C', 'D']),
        isBudgeted: chance(0.85), status: 'ACTIVE', approvalStatus: 'APROVADO',
      },
    });
  }

  // 15) Resumo + verificação de que a Goiasa não mudou
  const after = await snapshot(companyId);
  const goiasaAfter = await snapshot(goiasa.id);
  const goiasaUnchanged = JSON.stringify(goiasaBefore) === JSON.stringify(goiasaAfter);

  console.log('\n=== RESUMO (Empresa Demonstração) ===');
  console.log(JSON.stringify(after, null, 2));
  console.log(`\nGoiasa inalterada: ${goiasaUnchanged ? 'SIM ✅' : 'NÃO ⚠️'}`);
  if (!goiasaUnchanged) {
    console.error('ALERTA: snapshot da Goiasa mudou!', { goiasaBefore, goiasaAfter });
  }
  console.log('\n=== CREDENCIAIS DEMO ===');
  console.log(`Senha padrão: ${DEMO_PASSWORD}`);
  for (const d of demoUserDefs) console.log(`  ${d.email}  (${d.role})`);
}

async function snapshot(companyId: string) {
  const [orgNode, branch, user, indicator, indicatorTarget, indicatorResult, strategicMap, perspective, strategicObjective, actionPlan, deviation, meeting, project, okrCycle, orgJob, orgEmployee] = await Promise.all([
    prisma.orgNode.count({ where: { companyId, deletedAt: null } }),
    prisma.branch.count({ where: { companyId, deletedAt: null } }),
    prisma.user.count({ where: { companyId, deletedAt: null } }),
    prisma.indicator.count({ where: { companyId, deletedAt: null } }),
    prisma.indicatorTarget.count({ where: { indicator: { companyId } } }),
    prisma.indicatorResult.count({ where: { indicator: { companyId } } }),
    prisma.strategicMap.count({ where: { companyId } }),
    prisma.perspective.count({ where: { map: { companyId } } }),
    prisma.strategicObjective.count({ where: { map: { companyId } } }),
    prisma.actionPlan.count({ where: { companyId, deletedAt: null } }),
    prisma.deviation.count({ where: { companyId } }),
    prisma.meeting.count({ where: { companyId } }),
    prisma.project.count({ where: { companyId } }),
    prisma.oKRCycle.count({ where: { companyId } }),
    prisma.orgJob.count({ where: { companyId } }),
    prisma.orgEmployee.count({ where: { companyId } }),
  ]);
  return { orgNode, branch, user, indicator, indicatorTarget, indicatorResult, strategicMap, perspective, strategicObjective, actionPlan, deviation, meeting, project, okrCycle, orgJob, orgEmployee };
}

main()
  .catch((e) => { console.error('SEED DEMO ERROR', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
