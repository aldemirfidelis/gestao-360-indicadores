/** Seed aditivo, transacional e exclusivo da Empresa Demonstração. Nenhum dado é apagado. */
import { PrismaClient, Prisma, UserRoleEnum } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { calcStatus, PUBLIC_DEMO_COMPANY_SLUG, PUBLIC_DEMO_EMAIL, PUBLIC_DEMO_PROFILE, isProductPermissionActive } from '@g360/shared';
import { PERMISSION_CATALOG } from '../src/modules/users/permission-catalog';
const client = new PrismaClient();
const MARKER = 'demo.focus.v1';
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

// ---------- catálogos fictícios (indústria genérica de manufatura) ----------
// (a árvore organizacional e os indicadores são definidos explicitamente em main();
//  estes pools alimentam apenas rótulos/títulos dos demais módulos)
const AREA_POOL = ['Operações', 'Produção', 'Qualidade', 'SSMA', 'Comercial', 'Financeiro', 'Recursos Humanos', 'Suprimentos', 'Logística', 'Manutenção'];
const OBJECTIVE_POOL = [
  'Aumentar a rentabilidade', 'Reduzir os custos operacionais', 'Zerar acidentes de trabalho',
  'Elevar a satisfação dos clientes', 'Desenvolver competências da equipe', 'Reduzir o impacto ambiental',
  'Ampliar a participação de mercado', 'Aumentar a disponibilidade dos ativos', 'Melhorar a qualidade dos produtos',
  'Otimizar a logística de entrega', 'Fortalecer a cultura de segurança', 'Aumentar a produtividade',
  'Modernizar o parque fabril', 'Reduzir perdas de processo', 'Acelerar o lançamento de produtos',
];
const FIRST_NAMES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Eduarda', 'Felipe', 'Gabriela', 'Henrique', 'Isabela', 'João', 'Karina', 'Lucas', 'Mariana', 'Nelson', 'Otávio', 'Patrícia', 'Rafael', 'Sabrina', 'Thiago', 'Vanessa'];
const LAST_NAMES = ['Silva', 'Souza', 'Oliveira', 'Santos', 'Pereira', 'Lima', 'Costa', 'Almeida', 'Ferreira', 'Rodrigues', 'Gomes', 'Martins', 'Araújo', 'Barbosa', 'Ribeiro', 'Carvalho'];
const JOB_POOL = [
  'Operador de Produção', 'Técnico de Manutenção', 'Analista de Qualidade', 'Supervisor de Produção',
  'Analista Comercial', 'Auxiliar Administrativo', 'Técnico de Segurança', 'Analista de RH',
  'Coordenador Industrial', 'Assistente de Logística', 'Comprador', 'Analista Financeiro',
  'Eletricista de Manutenção', 'Vendedor',
];
const PROJECT_POOL = ['Modernização da Linha de Produção', 'Automação de Processos', 'Eficiência Energética', 'Redução de Perdas e Refugo', 'Programa de Segurança Comportamental', 'Expansão da Capacidade Produtiva'];
const MEETING_POOL = ['Reunião de Análise de Indicadores', 'Comitê de Produção', 'Reunião de Segurança', 'Análise Crítica de Desvios', 'Reunião de Resultados Mensais'];
const ACTION_POOL = ['Plano de redução de perdas', 'Ação corretiva de manutenção', 'Melhoria de eficiência operacional', 'Plano de capacitação da equipe', 'Ação de conformidade ambiental', 'Plano de redução de paradas', 'Ação de melhoria de qualidade', 'Plano de segurança comportamental'];
const DEVIATION_POOL = ['Desvio de meta de produção', 'Não conformidade ambiental', 'Desvio de eficiência produtiva', 'Parada não programada de equipamento', 'Desvio de meta de segurança', 'Desvio de qualidade do produto'];
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

async function populate(prisma: Prisma.TransactionClient) {
  await prisma.$executeRaw`SELECT pg_advisory_xact_lock(360, 2026)`;
  const candidates = await prisma.company.findMany({ where: { deletedAt: null, OR: [{ slug: PUBLIC_DEMO_COMPANY_SLUG }, { name: 'Empresa Demonstração' }, { name: 'Empresa Demonstracao' }] } });
  if (candidates.length > 1) throw new Error('Mais de uma empresa de demonstração: resolver o alvo antes de executar.');
  const demo = candidates[0] ?? await prisma.company.create({ data: { name: 'Empresa Demonstração', tradeName: 'Empresa Demonstração', slug: PUBLIC_DEMO_COMPANY_SLUG, notes: 'Empresa fictícia exclusiva para demonstração pública.' } });
  if (!/demonstra/i.test(demo.name)) throw new Error('Slug demo vinculado a empresa não demonstrativa.');
  if (demo.slug && demo.slug !== PUBLIC_DEMO_COMPANY_SLUG) throw new Error('Empresa demonstração usa outro slug; revisar antes de executar.');
  const companyId = demo.id;
  if (!demo.slug) await prisma.company.update({ where: { id: companyId }, data: { slug: PUBLIC_DEMO_COMPANY_SLUG } });
  await prisma.platformCompanyProfile.upsert({ where: { companyId }, create: { companyId, planCode: 'ENTERPRISE', notes: 'Licença exclusiva de demonstração fictícia.' }, update: { planCode: 'ENTERPRISE' } });
  const collision = await prisma.user.findUnique({ where: { email: PUBLIC_DEMO_EMAIL } });
  if (collision && collision.companyId !== companyId) throw new Error('Usuário reservado já pertence a outra empresa.');
  const profile = await prisma.accessProfile.upsert({ where: { companyId_code: { companyId, code: PUBLIC_DEMO_PROFILE } }, create: { companyId, code: PUBLIC_DEMO_PROFILE, name: 'Visitante da demonstração', role: 'COMPANY_ADMIN' }, update: {} });
  const permissions = PERMISSION_CATALOG.filter(([key, , , action]) => ['view', 'export'].includes(action) && isProductPermissionActive(key));
  await prisma.permission.createMany({ data: permissions.map(([key, description, module, action]) => ({ key, description, module, action })), skipDuplicates: true });
  const stored = await prisma.permission.findMany({ where: { key: { in: permissions.map(([key]) => key) } } });
  await prisma.profilePermission.createMany({ data: stored.map(p => ({ profileId: profile.id, permissionId: p.id })), skipDuplicates: true });
  const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
  const visitor = await prisma.user.upsert({ where: { email: PUBLIC_DEMO_EMAIL }, create: { companyId, email: PUBLIC_DEMO_EMAIL, name: 'Visitante Demonstração', role: 'COMPANY_ADMIN', accessProfileId: profile.id, passwordHash }, update: { role: 'COMPANY_ADMIN', accessProfileId: profile.id, activeCompanyId: null, active: true, status: 'ACTIVE', deletedAt: null } });
  const existing = await prisma.appSetting.findUnique({ where: { companyId_key: { companyId, key: MARKER } } });
  if (existing) { await repairDemoLights(prisma, companyId); await prisma.prizeAnnexVersion.updateMany({ where: { annex: { companyId, code: 'FD-ANEXO' }, status: 'APPROVED' }, data: { status: 'EFFECTIVE' } }); await populateDemoDetails(prisma, companyId, visitor.id, passwordHash); console.log('Demonstração já preenchida; nenhuma duplicação.'); return companyId; }
  // 3) Branch
  const branch = await prisma.branch.create({
    data: { companyId, name: 'Unidade Demonstração', code: 'FOCUS-DEMO', city: 'Goiatuba', state: 'GO', active: true },
    select: { id: true },
  });

  // 4) Árvore organizacional — estrutura PRÓPRIA, enxuta e genérica (NÃO clona a Goiasa)
  const ORG_TREE: { area: string; color: string; sectors: string[] }[] = [
    { area: 'Operações / Produção', color: '#2563eb', sectors: ['Linha de Produção', 'Manutenção', 'PCP – Planejamento e Controle'] },
    { area: 'Qualidade & SSMA', color: '#16a34a', sectors: ['Qualidade', 'Saúde, Segurança e Meio Ambiente'] },
    { area: 'Comercial & Marketing', color: '#d97706', sectors: ['Vendas', 'Marketing'] },
    { area: 'Administrativo & Financeiro', color: '#7c3aed', sectors: ['Financeiro', 'Recursos Humanos', 'Suprimentos / Compras'] },
    { area: 'Logística', color: '#0891b2', sectors: ['Expedição', 'Armazém'] },
  ];
  const rootNode = await prisma.orgNode.create({
    data: { companyId, branchId: branch.id, parentId: null, name: 'Unidade Matriz', type: 'BRANCH', position: 0, active: true, color: '#0f172a' },
    select: { id: true },
  });
  const areaNodeIds: string[] = [];
  const sectorNodeIds: string[] = [];
  const areaByName = new Map<string, string>();
  const sectorByName = new Map<string, string>();
  let nodePos = 1;
  for (const a of ORG_TREE) {
    const areaNode = await prisma.orgNode.create({
      data: { companyId, branchId: branch.id, parentId: rootNode.id, name: a.area, type: 'AREA', position: nodePos++, active: true, color: a.color },
      select: { id: true },
    });
    areaNodeIds.push(areaNode.id);
    areaByName.set(a.area, areaNode.id);
    for (const s of a.sectors) {
      const sectorNode = await prisma.orgNode.create({
        data: { companyId, branchId: branch.id, parentId: areaNode.id, name: s, type: 'SECTOR', position: nodePos++, active: true, color: a.color },
        select: { id: true },
      });
      sectorNodeIds.push(sectorNode.id);
      sectorByName.set(s, sectorNode.id);
    }
  }
  // Nós atribuíveis (áreas primeiro, depois setores) — usado para distribuir donos/ações/etc.
  const areaIds = [...areaNodeIds, ...sectorNodeIds];


  const presenterAreaId = areaIds[0];
  const demoMainId = visitor.id;
  const demoUsers: { id: string; role: UserRoleEnum }[] = [{ id: visitor.id, role: UserRoleEnum.COMPANY_ADMIN }];
  const userIds = [visitor.id];
  await prisma.user.update({ where: { id: visitor.id }, data: { branchId: branch.id, defaultNodeId: presenterAreaId } });
  await prisma.userAreaAssignment.upsert({ where: { userId_orgNodeId: { userId: visitor.id, orgNodeId: presenterAreaId } }, create: { companyId, userId: visitor.id, orgNodeId: presenterAreaId, assignmentType: 'PRIMARY', isPrimary: true }, update: {} });
  // 6) Indicadores PRÓPRIOS distribuídos pelos setores (sem espelhar a Goiasa)
  type IndUnit = 'PERCENT' | 'CURRENCY' | 'QUANTITY' | 'HOURS' | 'INDEX';
  type IndType = 'STRATEGIC' | 'PRODUCTION' | 'MAINTENANCE' | 'QUALITY' | 'SAFETY' | 'COMMERCIAL' | 'FINANCE' | 'HR' | 'PROCUREMENT' | 'PROCESS';
  type IndDef = { sector: string; name: string; unit: IndUnit; dir: 'HIGHER_BETTER' | 'LOWER_BETTER'; type: IndType };
  const IND_DEFS: IndDef[] = [
    // Operações / Produção
    { sector: 'Linha de Produção', name: 'OEE da Produção', unit: 'PERCENT', dir: 'HIGHER_BETTER', type: 'STRATEGIC' },
    { sector: 'Linha de Produção', name: 'Volume Produzido', unit: 'QUANTITY', dir: 'HIGHER_BETTER', type: 'PRODUCTION' },
    { sector: 'Linha de Produção', name: 'Taxa de Refugo', unit: 'PERCENT', dir: 'LOWER_BETTER', type: 'QUALITY' },
    { sector: 'Manutenção', name: 'Disponibilidade de Equipamentos', unit: 'PERCENT', dir: 'HIGHER_BETTER', type: 'STRATEGIC' },
    { sector: 'Manutenção', name: 'Paradas Não Programadas', unit: 'HOURS', dir: 'LOWER_BETTER', type: 'MAINTENANCE' },
    { sector: 'Manutenção', name: 'Cumprimento da Manutenção Preventiva', unit: 'PERCENT', dir: 'HIGHER_BETTER', type: 'MAINTENANCE' },
    { sector: 'PCP – Planejamento e Controle', name: 'Aderência ao Plano de Produção', unit: 'PERCENT', dir: 'HIGHER_BETTER', type: 'PRODUCTION' },
    { sector: 'PCP – Planejamento e Controle', name: 'Giro de Estoque', unit: 'INDEX', dir: 'HIGHER_BETTER', type: 'PROCESS' },
    // Qualidade & SSMA
    { sector: 'Qualidade', name: 'Conformidade de Qualidade', unit: 'PERCENT', dir: 'HIGHER_BETTER', type: 'STRATEGIC' },
    { sector: 'Qualidade', name: 'Taxa de Retrabalho', unit: 'PERCENT', dir: 'LOWER_BETTER', type: 'QUALITY' },
    { sector: 'Qualidade', name: 'Reclamações de Clientes', unit: 'QUANTITY', dir: 'LOWER_BETTER', type: 'QUALITY' },
    { sector: 'Saúde, Segurança e Meio Ambiente', name: 'Taxa de Frequência de Acidentes', unit: 'INDEX', dir: 'LOWER_BETTER', type: 'STRATEGIC' },
    { sector: 'Saúde, Segurança e Meio Ambiente', name: 'Acidentes com Afastamento', unit: 'QUANTITY', dir: 'LOWER_BETTER', type: 'SAFETY' },
    { sector: 'Saúde, Segurança e Meio Ambiente', name: 'Conformidade Ambiental', unit: 'PERCENT', dir: 'HIGHER_BETTER', type: 'QUALITY' },
    // Comercial & Marketing
    { sector: 'Vendas', name: 'Faturamento', unit: 'CURRENCY', dir: 'HIGHER_BETTER', type: 'STRATEGIC' },
    { sector: 'Vendas', name: 'Atingimento da Meta de Vendas', unit: 'PERCENT', dir: 'HIGHER_BETTER', type: 'COMMERCIAL' },
    { sector: 'Vendas', name: 'Novos Clientes', unit: 'QUANTITY', dir: 'HIGHER_BETTER', type: 'COMMERCIAL' },
    { sector: 'Marketing', name: 'Leads Gerados', unit: 'QUANTITY', dir: 'HIGHER_BETTER', type: 'COMMERCIAL' },
    { sector: 'Marketing', name: 'Satisfação do Cliente (NPS)', unit: 'PERCENT', dir: 'HIGHER_BETTER', type: 'STRATEGIC' },
    // Administrativo & Financeiro
    { sector: 'Financeiro', name: 'Margem de Contribuição', unit: 'PERCENT', dir: 'HIGHER_BETTER', type: 'STRATEGIC' },
    { sector: 'Financeiro', name: 'Inadimplência', unit: 'PERCENT', dir: 'LOWER_BETTER', type: 'FINANCE' },
    { sector: 'Financeiro', name: 'Custo Operacional', unit: 'CURRENCY', dir: 'LOWER_BETTER', type: 'FINANCE' },
    { sector: 'Recursos Humanos', name: 'Turnover', unit: 'PERCENT', dir: 'LOWER_BETTER', type: 'HR' },
    { sector: 'Recursos Humanos', name: 'Absenteísmo', unit: 'PERCENT', dir: 'LOWER_BETTER', type: 'HR' },
    { sector: 'Recursos Humanos', name: 'Índice de Treinamento', unit: 'PERCENT', dir: 'HIGHER_BETTER', type: 'HR' },
    { sector: 'Recursos Humanos', name: 'Engajamento da Equipe', unit: 'PERCENT', dir: 'HIGHER_BETTER', type: 'STRATEGIC' },
    { sector: 'Suprimentos / Compras', name: 'Saving em Compras', unit: 'PERCENT', dir: 'HIGHER_BETTER', type: 'PROCUREMENT' },
    { sector: 'Suprimentos / Compras', name: 'Entregas de Fornecedores no Prazo', unit: 'PERCENT', dir: 'HIGHER_BETTER', type: 'PROCUREMENT' },
    // Logística
    { sector: 'Expedição', name: 'OTIF – Entregas no Prazo e Completas', unit: 'PERCENT', dir: 'HIGHER_BETTER', type: 'STRATEGIC' },
    { sector: 'Expedição', name: 'Custo de Frete', unit: 'CURRENCY', dir: 'LOWER_BETTER', type: 'PROCESS' },
    { sector: 'Armazém', name: 'Acuracidade de Estoque', unit: 'PERCENT', dir: 'HIGHER_BETTER', type: 'PROCESS' },
    { sector: 'Armazém', name: 'Nível de Serviço Logístico', unit: 'PERCENT', dir: 'HIGHER_BETTER', type: 'PROCESS' },
  ];
  const demoIndicators: { id: string; unit: string; direction: string; periodicity: string; yellowToleranceP: number }[] = [];
  const indByName = new Map<string, string>();
  let indSeq = 0;
  for (const d of IND_DEFS) {
    indSeq += 1;
    const ownerNodeId = sectorByName.get(d.sector) ?? pick(areaIds);
    const yellowToleranceP = 90;
    const created = await prisma.indicator.create({
      data: {
        companyId, ownerNodeId, name: d.name, code: `FD-IND-${String(indSeq).padStart(3, '0')}`,
        type: d.type, unit: d.unit, direction: d.dir, periodicity: 'MONTHLY',
        weight: 1, yellowToleranceP,
        responsibleUserId: pick(userIds), feederUserId: pick(userIds), status: 'ACTIVE',
        description: `Indicador de ${d.sector} (demonstração).`,
      },
      select: { id: true },
    });
    indByName.set(d.name, created.id);
    demoIndicators.push({ id: created.id, unit: d.unit, direction: d.dir, periodicity: 'MONTHLY', yellowToleranceP });
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

  // 8) Mapa estratégico PRÓPRIO (BSC: 4 perspectivas + 10 objetivos), sem clonar a Goiasa
  type PerspKind = 'FINANCIAL' | 'CUSTOMERS' | 'INTERNAL_PROCESS' | 'LEARNING_GROWTH';
  const mapStartsAt = new Date(new Date().getFullYear(), 0, 1);
  const mapEndsAt = new Date(new Date().getFullYear(), 11, 31);
  const map = await prisma.strategicMap.create({
    data: { companyId, name: 'Mapa Estratégico (Demonstração)', description: 'Mapa estratégico próprio da Empresa Demonstração (fictício).', startsAt: mapStartsAt, endsAt: mapEndsAt, active: true },
    select: { id: true },
  });
  const PERSPECTIVES: { kind: PerspKind; name: string }[] = [
    { kind: 'FINANCIAL', name: 'Financeira' },
    { kind: 'CUSTOMERS', name: 'Clientes' },
    { kind: 'INTERNAL_PROCESS', name: 'Processos Internos' },
    { kind: 'LEARNING_GROWTH', name: 'Aprendizado e Crescimento' },
  ];
  const perspByKind = new Map<PerspKind, string>();
  for (let pi = 0; pi < PERSPECTIVES.length; pi++) {
    const p = PERSPECTIVES[pi];
    const created = await prisma.perspective.create({
      data: { mapId: map.id, kind: p.kind, name: p.name, position: pi, positionX: 0, positionY: pi * 200, width: 1240, height: 180 },
      select: { id: true },
    });
    perspByKind.set(p.kind, created.id);
  }
  type ObjDef = { persp: PerspKind; name: string; node: string; inds: string[] };
  const OBJ_DEFS: ObjDef[] = [
    { persp: 'FINANCIAL', name: 'Aumentar a rentabilidade', node: 'Administrativo & Financeiro', inds: ['Faturamento', 'Margem de Contribuição'] },
    { persp: 'FINANCIAL', name: 'Reduzir os custos operacionais', node: 'Administrativo & Financeiro', inds: ['Custo Operacional'] },
    { persp: 'CUSTOMERS', name: 'Elevar a satisfação dos clientes', node: 'Comercial & Marketing', inds: ['Satisfação do Cliente (NPS)', 'Reclamações de Clientes'] },
    { persp: 'CUSTOMERS', name: 'Ampliar a participação de mercado', node: 'Comercial & Marketing', inds: ['Novos Clientes', 'Atingimento da Meta de Vendas'] },
    { persp: 'INTERNAL_PROCESS', name: 'Aumentar a eficiência produtiva', node: 'Operações / Produção', inds: ['OEE da Produção', 'Disponibilidade de Equipamentos'] },
    { persp: 'INTERNAL_PROCESS', name: 'Garantir a qualidade dos produtos', node: 'Qualidade & SSMA', inds: ['Conformidade de Qualidade', 'Taxa de Retrabalho'] },
    { persp: 'INTERNAL_PROCESS', name: 'Entregar no prazo (OTIF)', node: 'Logística', inds: ['OTIF – Entregas no Prazo e Completas'] },
    { persp: 'LEARNING_GROWTH', name: 'Desenvolver competências da equipe', node: 'Administrativo & Financeiro', inds: ['Índice de Treinamento'] },
    { persp: 'LEARNING_GROWTH', name: 'Fortalecer a cultura de segurança', node: 'Qualidade & SSMA', inds: ['Taxa de Frequência de Acidentes'] },
    { persp: 'LEARNING_GROWTH', name: 'Engajar e reter talentos', node: 'Administrativo & Financeiro', inds: ['Engajamento da Equipe', 'Turnover'] },
  ];
  const OBJ_STATUS = ['ON_TRACK', 'ON_TRACK', 'AT_RISK', 'PLANNED'] as const;
  const objMap = new Map<string, string>(); // nome do objetivo -> id
  const perspColCount = new Map<PerspKind, number>();
  for (const o of OBJ_DEFS) {
    const col = perspColCount.get(o.persp) ?? 0;
    perspColCount.set(o.persp, col + 1);
    const perspIndex = PERSPECTIVES.findIndex((p) => p.kind === o.persp);
    const ownerNodeId = areaByName.get(o.node) ?? null;
    const obj = await prisma.strategicObjective.create({
      data: {
        mapId: map.id, perspectiveId: perspByKind.get(o.persp)!, name: o.name,
        ownerNodeId, responsibleUserId: chance(0.8) ? pick(userIds) : null,
        weight: 1, status: pick([...OBJ_STATUS]), priority: rint(1, 5),
        position: col, positionX: 40 + col * 300, positionY: 40 + perspIndex * 200, width: 260, height: 150,
      },
      select: { id: true },
    });
    objMap.set(o.name, obj.id);
    for (const indName of o.inds) {
      const indicatorId = indByName.get(indName);
      if (indicatorId) await prisma.strategicObjectiveIndicator.create({ data: { objectiveId: obj.id, indicatorId } });
    }
    if (ownerNodeId) await prisma.strategicObjectiveOrgNode.create({ data: { objectiveId: obj.id, orgNodeId: ownerNodeId, kind: 'responsavel' } });
  }
  // relações de causa-efeito (aprendizado -> processos -> clientes -> financeiro)
  const OBJ_RELATIONS: [string, string][] = [
    ['Desenvolver competências da equipe', 'Aumentar a eficiência produtiva'],
    ['Fortalecer a cultura de segurança', 'Aumentar a eficiência produtiva'],
    ['Engajar e reter talentos', 'Garantir a qualidade dos produtos'],
    ['Aumentar a eficiência produtiva', 'Reduzir os custos operacionais'],
    ['Garantir a qualidade dos produtos', 'Elevar a satisfação dos clientes'],
    ['Entregar no prazo (OTIF)', 'Elevar a satisfação dos clientes'],
    ['Elevar a satisfação dos clientes', 'Ampliar a participação de mercado'],
    ['Ampliar a participação de mercado', 'Aumentar a rentabilidade'],
    ['Reduzir os custos operacionais', 'Aumentar a rentabilidade'],
  ];
  for (const [from, to] of OBJ_RELATIONS) {
    const fromId = objMap.get(from);
    const toId = objMap.get(to);
    if (!fromId || !toId || fromId === toId) continue;
    await prisma.objectiveRelation.create({ data: { fromId, toId, weight: 1, kind: 'impacta', label: null } });
  }

  // ---------- atividade (gerada num volume saudável p/ demo) ----------
  const allIndIds = demoIndicators.map((i) => i.id);
  const allObjIds = [...objMap.values()];

  // 9) Planos de ação
  const actionTitle = namer(ACTION_POOL);
  const ACTION_STATUS = ['NOT_STARTED', 'IN_PROGRESS', 'IN_PROGRESS', 'WAITING_EVIDENCE', 'DONE', 'DONE'] as const;
  const PRIORITY = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
  const actionIds: string[] = [];
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
    actionIds.push(action.id);
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
  const deviationIds: string[] = [];
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
    deviationIds.push(dev.id);
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
      await prisma.meetingParticipant.create({ data: { meetingId: meeting.id, userId: uid, role: 'PARTICIPANT', attended: chance(0.8) } });
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
        ownerName: randomName(), team: pick(['Operações', 'Comercial', 'Administrativo']),
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
  const projectIds: string[] = [];
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
    projectIds.push(project.id);
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

  // 22) Sessoes de analise de causa (Ishikawa / 5 Porques / PDCA) ligadas a planos de acao
  const analysisActions = actionIds.slice(0, 2);
  for (const actionId of analysisActions) {
    const ishikawa = await prisma.actionAnalysisSession.create({
      data: {
        actionId, method: 'ISHIKAWA', status: 'VALIDATED',
        problem: 'Resultado do indicador abaixo da meta no periodo (demonstracao).',
        rootCause: 'Falta de padronizacao na operacao somada a desgaste de equipamento critico.',
        responsibleUserId: pick(userIds),
      },
      select: { id: true },
    });
    for (const cat of SIX_M) {
      await prisma.actionIshikawaCause.create({
        data: {
          sessionId: ishikawa.id, category: cat, title: `Causa de ${cat}`,
          description: `Causa potencial relacionada a ${cat.toLowerCase()} identificada no brainstorming (ficticia).`,
          priority: pick(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const), impact: rint(2, 5), probability: rint(2, 5),
          status: pick(['DRAFT', 'CONFIRMED', 'DISCARDED'] as const), likelyRootCause: chance(0.3), responsibleUserId: pick(userIds),
        },
      });
    }
    const whys = await prisma.actionAnalysisSession.create({
      data: { actionId, method: 'FIVE_WHYS', status: 'READY', problem: 'Por que o indicador ficou abaixo da meta no periodo?', responsibleUserId: pick(userIds) },
      select: { id: true },
    });
    const whyQuestions = [
      'Por que o resultado ficou abaixo da meta?',
      'Por que houve parada nao programada no equipamento?',
      'Por que o equipamento falhou durante a operacao?',
      'Por que a manutencao preventiva nao detectou o desgaste?',
      'Por que o plano de manutencao estava desatualizado?',
    ];
    for (let p = 0; p < whyQuestions.length; p++) {
      await prisma.actionFiveWhy.create({
        data: { sessionId: whys.id, position: p + 1, question: whyQuestions[p], answer: 'Resposta investigada com a equipe (ficticia para demonstracao).', isRootCause: p === whyQuestions.length - 1 },
      });
    }
    const pdca = await prisma.actionAnalysisSession.create({
      data: { actionId, method: 'PDCA', status: 'IN_PROGRESS', problem: 'Ciclo de melhoria continua para recuperar o indicador.', responsibleUserId: pick(userIds) },
      select: { id: true },
    });
    const phases: [string, string, string][] = [
      ['PLAN', 'Planejar', 'Definir metas, analisar causas e elaborar o plano de acao'],
      ['DO', 'Executar', 'Implementar as acoes planejadas e treinar a equipe'],
      ['CHECK', 'Verificar', 'Avaliar os resultados versus as metas estabelecidas'],
      ['ACT', 'Agir', 'Padronizar o que funcionou ou corrigir o que desviou'],
    ];
    for (let pi = 0; pi < phases.length; pi++) {
      const [phase, title, objective] = phases[pi];
      await prisma.actionPdcaStep.create({
        data: {
          sessionId: pdca.id, phase, title, objective, description: 'Etapa do ciclo PDCA (ficticia para demonstracao).',
          priority: 'MEDIUM', progress: pi === 0 ? 100 : pi === 1 ? 60 : 0,
          status: pi === 0 ? 'DONE' : pi === 1 ? 'IN_PROGRESS' : 'PENDING', responsibleUserId: pick(userIds),
        },
      });
    }
  }

  // 24) Reuniao Mensal de Resultados (executiva, completa) - interconecta indicadores/desvios/acoes/areas
  const meetingPeriod = months[Math.max(0, months.length - 2)];
  const periodResults = await prisma.indicatorResult.findMany({ where: { indicator: { companyId }, periodRef: meetingPeriod.periodRef }, select: { indicatorId: true, value: true, attainment: true, deviationPct: true, light: true } });
  const periodTargets = await prisma.indicatorTarget.findMany({ where: { indicator: { companyId }, periodRef: meetingPeriod.periodRef }, select: { indicatorId: true, target: true } });
  const resultByInd = new Map(periodResults.map((r) => [r.indicatorId, r]));
  const targetByInd = new Map(periodTargets.map((t) => [t.indicatorId, t.target]));
  const meetingStart = new Date(Date.now() - rint(3, 12) * 86_400_000);
  meetingStart.setHours(9, 0, 0, 0);
  const closedMeeting = await prisma.monthlyMeeting.create({
    data: {
      companyId, title: `Reuniao Mensal de Resultados - ${meetingPeriod.periodRef}`, periodRef: meetingPeriod.periodRef,
      cropSeason: `Exercício ${year}`, cycleName: 'Ciclo Mensal de Resultados', status: 'CLOSED', format: 'HYBRID',
      startsAt: meetingStart, endsAt: new Date(meetingStart.getTime() + 3 * 3_600_000), location: 'Auditorio Central',
      responsibleUserId: demoUsers.find((u) => u.role === UserRoleEnum.DIRECTOR)?.id ?? pick(userIds),
      secretaryUserId: demoUsers.find((u) => u.role === UserRoleEnum.ANALYST)?.id ?? pick(userIds),
      followUpUserId: demoUsers.find((u) => u.role === UserRoleEnum.MANAGER)?.id ?? pick(userIds),
      objective: 'Analisar criticamente os resultados do mes, tratar desvios e alinhar diretrizes com a diretoria.',
      assumptions: 'Dados consolidados ate o fechamento do periodo. Metas conforme planejamento do exercicio.',
      criticalRisks: 'Risco de parada nao programada na linha de producao; atraso de fornecedores afetando a producao.',
      boardDirections: 'Priorizar disponibilidade de ativos e seguranca; manter investimento em manutencao preventiva.',
      generalNotes: 'Reuniao conduzida com presenca da diretoria e gestores das areas industriais.',
      keyMessage: 'Mes positivo em producao, com atencao redobrada para paradas nao programadas.',
      nextMonthlyAt: new Date(meetingStart.getTime() + 30 * 86_400_000), nextWeeklyAt: new Date(meetingStart.getTime() + 7 * 86_400_000),
      closedAt: new Date(meetingStart.getTime() + 3 * 3_600_000), createdById: pick(userIds),
    },
    select: { id: true },
  });
  const meetingAreaIds = [...new Set(areaIds)].slice(0, 4);
  const indPool = [...allIndIds].sort(() => Math.random() - 0.5);
  let areaPos = 0;
  for (const orgNodeId of meetingAreaIds) {
    const area = await prisma.monthlyMeetingArea.create({
      data: {
        meetingId: closedMeeting.id, orgNodeId, position: areaPos, readiness: 'VALIDATED', presenterUserId: pick(userIds),
        areaKeyMessage: pick(['Area dentro das metas com pontos de atencao.', 'Resultados estaveis e plano de acao em curso.', 'Desvio tratado com acao corretiva definida.']),
        validatedById: pick(userIds), validatedAt: new Date(meetingStart.getTime() - rint(1, 5) * 86_400_000),
      },
      select: { id: true },
    });
    const areaInds = indPool.splice(0, rint(2, 3));
    let indPos = 0;
    for (const indId of areaInds) {
      const r = resultByInd.get(indId);
      const light = (r?.light ?? 'GRAY') as 'GREEN' | 'YELLOW' | 'RED' | 'GRAY';
      const critical = light === 'RED';
      await prisma.monthlyMeetingIndicator.create({
        data: {
          meetingId: closedMeeting.id, meetingAreaId: area.id, indicatorId: indId,
          target: targetByInd.get(indId) ?? null, current: r?.value ?? null, attainment: r?.attainment ?? null,
          deviationPct: r?.deviationPct ?? null, light, trend: pick(['UP', 'DOWN', 'STABLE']),
          managerComment: critical ? 'Resultado abaixo da meta; desvio aberto e plano de acao em andamento.' : 'Resultado dentro do esperado para o periodo.',
          executiveStatus: critical ? 'Requer atencao da diretoria' : 'Sob controle', isCritical: critical, showInPresentation: true,
          financialImpact: critical ? round2(rfloat(10_000, 200_000)) : null, position: indPos,
          deviationId: critical && deviationIds.length ? pick(deviationIds) : null, actionPlanId: critical && actionIds.length ? pick(actionIds) : null,
        },
      });
      indPos += 1;
    }
    areaPos += 1;
  }
  const agendaTopics = ['Abertura e leitura da ata anterior', 'Resultados por area', 'Desvios criticos e planos de acao', 'Riscos e diretrizes da diretoria', 'Padronizacao e licoes aprendidas', 'Encerramento e proximos passos'];
  for (let a = 0; a < agendaTopics.length; a++) {
    await prisma.monthlyMeetingAgendaItem.create({
      data: { meetingId: closedMeeting.id, topic: agendaTopics[a], position: a, plannedMinutes: rint(10, 30), actualMinutes: rint(8, 35), presentationStatus: 'DISCUSSED', presenterUserId: pick(userIds), notes: chance(0.4) ? 'Discussao registrada em ata (ficticia).' : null },
    });
  }
  const decisionDefs: Array<{ kind: 'DECISION' | 'RISK' | 'ESCALATION' | 'PENDING'; description: string }> = [
    { kind: 'DECISION', description: 'Aprovar a antecipacao da manutencao preventiva da linha de producao para reduzir paradas.' },
    { kind: 'RISK', description: 'Monitorar risco de atraso de fornecedores que pode impactar a producao.' },
    { kind: 'ESCALATION', description: 'Escalar para a diretoria a necessidade de contratacao de tecnicos de manutencao.' },
  ];
  for (const d of decisionDefs) {
    await prisma.monthlyMeetingDecision.create({
      data: { meetingId: closedMeeting.id, kind: d.kind, topic: 'Resultados e riscos do mes', description: d.description, ownerName: randomName(), ownerUserId: pick(userIds), dueDate: new Date(meetingStart.getTime() + rint(7, 30) * 86_400_000), status: pick(['OPEN', 'IN_PROGRESS'] as const), actionPlanId: chance(0.5) && actionIds.length ? pick(actionIds) : null, createdById: pick(userIds) },
    });
  }
  for (let f = 0; f < 3; f++) {
    await prisma.monthlyMeetingFollowUp.create({
      data: { meetingId: closedMeeting.id, level: pick(['WEEKLY', 'MONTHLY'] as const), title: pick(['Acompanhar plano de reducao de paradas', 'Verificar evolucao da eficiencia produtiva', 'Revisar indicadores de seguranca']), dueDate: new Date(meetingStart.getTime() + rint(7, 30) * 86_400_000), ownerUserId: pick(userIds), indicatorId: chance(0.7) ? pick(allIndIds) : null, actionPlanId: chance(0.5) ? pick(actionIds) : null, status: pick(['OPEN', 'IN_PROGRESS'] as const) },
    });
  }
  for (let l = 0; l < 2; l++) {
    await prisma.monthlyMeetingLearning.create({
      data: { meetingId: closedMeeting.id, orgNodeId: pick(meetingAreaIds), indicatorId: chance(0.6) ? pick(allIndIds) : null, learning: pick(['A inspecao preditiva reduziu paradas na linha de producao.', 'O checklist de partida da linha evitou retrabalho.']), treatedCause: 'Falha de manutencao preventiva', effectiveAction: 'Revisao do plano de manutencao com periodicidade ajustada', replicateToNodeId: chance(0.5) ? pick(meetingAreaIds) : null, ownerUserId: pick(userIds), status: 'OPEN' },
    });
  }
  const stdDefs: Array<{ type: 'POP' | 'CHECKLIST' | 'TRAINING'; description: string }> = [
    { type: 'POP', description: 'Padronizar o procedimento de partida da linha de producao (POP) com base na licao aprendida.' },
    { type: 'CHECKLIST', description: 'Criar checklist de inspecao preditiva dos equipamentos para todas as unidades.' },
  ];
  for (const s of stdDefs) {
    await prisma.monthlyMeetingStandardization.create({
      data: { meetingId: closedMeeting.id, type: s.type, description: s.description, sourceNodeId: pick(meetingAreaIds), indicatorId: chance(0.5) ? pick(allIndIds) : null, ownerUserId: pick(userIds), dueDate: new Date(meetingStart.getTime() + rint(15, 45) * 86_400_000), status: 'OPEN' },
    });
  }
  for (const u of demoUsers) {
    await prisma.monthlyMeetingParticipant.create({
      data: { meetingId: closedMeeting.id, userId: u.id, role: u.role === UserRoleEnum.DIRECTOR ? 'RESPONSIBLE' : u.role === UserRoleEnum.ANALYST ? 'EXECUTOR' : 'PARTICIPANT', attended: chance(0.9) },
    });
  }
  const checklistItems = ['Resultados consolidados e validados', 'Desvios criticos com plano de acao', 'Atas anteriores revisadas', 'Apresentacoes das areas prontas', 'Diretrizes da diretoria registradas'];
  for (const label of checklistItems) {
    await prisma.monthlyMeetingChecklistItem.create({ data: { meetingId: closedMeeting.id, label, done: chance(0.8), severity: pick(['INFO', 'WARNING']) } });
  }
  // Reuniao do mes corrente em preparacao
  const currentPeriod = months[months.length - 1];
  const preparingMeeting = await prisma.monthlyMeeting.create({
    data: {
      companyId, title: `Reuniao Mensal de Resultados - ${currentPeriod.periodRef}`, periodRef: currentPeriod.periodRef,
      cropSeason: `Exercício ${year}`, cycleName: 'Ciclo Mensal de Resultados', status: 'PREPARING', format: 'HYBRID',
      startsAt: new Date(Date.now() + rint(3, 12) * 86_400_000), location: 'Auditorio Central',
      responsibleUserId: pick(userIds), secretaryUserId: pick(userIds),
      objective: 'Preparar a analise critica dos resultados do mes corrente.', createdById: pick(userIds),
    },
    select: { id: true },
  });
  let prepPos = 0;
  for (const orgNodeId of meetingAreaIds.slice(0, 3)) {
    await prisma.monthlyMeetingArea.create({
      data: { meetingId: preparingMeeting.id, orgNodeId, position: prepPos, readiness: pick(['NOT_STARTED', 'IN_PROGRESS', 'WITH_ISSUES'] as const), presenterUserId: pick(userIds) },
    });
    prepPos += 1;
  }

  // 20.5) INBOX GARANTIDO DO APRESENTADOR (demo@demo.com)
  // Garante que Meu Dia e Tarefas fiquem populados para a conta usada nas demos,
  // cobrindo TODOS os cards: pendentes, vencidos, vencendo hoje, aprovações,
  // indicadores fora da meta, riscos, documentos e reuniões de hoje.
  // =====================================================
  const todayAt = (h: number) => { const d = new Date(); d.setHours(h, 0, 0, 0); return d; };
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
  const daysAhead = (n: number) => new Date(Date.now() + n * 86_400_000);

  // (a) Planos de ação do apresentador: 1 vencido, 1 vence hoje, 1 futuro
  const presenterActions: { title: string; status: string; due: Date; progress: number; priority: string }[] = [
    { title: 'Reduzir refugo na Linha de Produção', status: 'IN_PROGRESS', due: daysAgo(4), progress: 45, priority: 'HIGH' },
    { title: 'Recuperar OEE abaixo da meta', status: 'IN_PROGRESS', due: todayAt(18), progress: 60, priority: 'CRITICAL' },
    { title: 'Implantar 5S no Armazém', status: 'WAITING_EVIDENCE', due: daysAhead(6), progress: 80, priority: 'MEDIUM' },
  ];
  for (const pa of presenterActions) {
    const a = await prisma.actionPlan.create({
      data: {
        companyId, branchId: branch.id, ownerNodeId: presenterAreaId, responsibleUserId: demoMainId, createdById: demoMainId,
        indicatorId: pick(allIndIds), title: pa.title, description: 'Plano de ação atribuído ao usuário de demonstração.',
        origin: 'MANUAL', priority: pa.priority as any, criticality: pa.priority as any,
        status: pa.status as any, startDate: daysAgo(25), dueDate: pa.due, progress: pa.progress,
      },
      select: { id: true },
    });
    await prisma.actionTask.create({ data: { actionId: a.id, title: 'Etapa em execução pelo responsável', done: false, assignedToId: demoMainId, position: 0, dueDate: pa.due } });
  }

  // (b) Três indicadores do apresentador FORA DA META (reatribui + força último resultado RED)
  const presenterInds = demoIndicators.slice(0, 3);
  const lastPeriod = months.map((m) => m.periodRef).sort()[months.length - 1];
  for (const ind of presenterInds) {
    await prisma.indicator.update({ where: { id: ind.id }, data: { responsibleUserId: demoMainId } });
    const targetRow = await prisma.indicatorTarget.findUnique({ where: { indicatorId_periodRef: { indicatorId: ind.id, periodRef: lastPeriod } } });
    const target = Number(targetRow?.target ?? 100);
    const value = round2(target * (ind.direction === 'LOWER_BETTER' ? 1.4 : 0.6));
    const calculated = calcStatus({ value, target, direction: ind.direction as any, yellowToleranceP: ind.yellowToleranceP });
    await prisma.indicatorResult.updateMany({ where: { indicatorId: ind.id, periodRef: lastPeriod }, data: { value, light: calculated.light as any, attainment: calculated.attainment, deviationAbs: calculated.deviationAbs, deviationPct: calculated.deviationPct } });
  }

  const presenterMeeting = await prisma.meeting.create({
    data: {
      companyId, title: 'Reunião de Acompanhamento de Indicadores', kind: 'INDICATORS' as any, format: 'PRESENTIAL' as any,
      status: 'SCHEDULED' as any, startsAt: todayAt(15), endsAt: todayAt(16), location: 'Sala de Reuniões 1',
      responsibleUserId: demoMainId, objective: 'Revisar indicadores fora da meta e planos de ação em andamento.',
      indicatorId: presenterInds[0]?.id ?? pick(allIndIds),
    },
    select: { id: true },
  });
  await prisma.meetingParticipant.create({ data: { meetingId: presenterMeeting.id, userId: demoMainId, role: 'PARTICIPANT', attended: false } });


  const board = await prisma.taskBoard.upsert({ where: { key: `CENTRAL_TRABALHO:${companyId}` }, update: {}, create: { key: `CENTRAL_TRABALHO:${companyId}`, companyId, name: 'Execução dos resultados', ownerId: demoMainId, visibility: 'COMPANY' } });
  const columns = await prisma.taskBoardColumn.findMany({ where: { boardId: board.id, statusKey: { in: ['TODO', 'IN_PROGRESS', 'DONE'] } }, orderBy: { position: 'asc' } });
  for (const [position, statusKey] of ['TODO', 'IN_PROGRESS', 'DONE'].entries()) if (!columns.some(c => c.statusKey === statusKey)) columns.push(await prisma.taskBoardColumn.create({ data: { boardId: board.id, name: ['A fazer', 'Em andamento', 'Concluído'][position], statusKey, position, color: ['blue', 'amber', 'green'][position], isDoneColumn: statusKey === 'DONE' } }));
  for (let i=0;i<6;i++) {
    const column = columns[i%3];
    const task = await prisma.workspaceTask.create({ data: { companyId, boardId: board.id, columnId: column.id, title: ['Consolidar resultados do mês', 'Validar plano de redução de perdas', 'Preparar apresentação do BSC', 'Acompanhar ações da reunião', 'Revisar metas de produtividade', 'Conferir espelhos do prêmio'][i], status: column.statusKey, priority: i%2 ? 'HIGH' : 'MEDIUM', dueDate: new Date(Date.now() + (i-2)*86400000), assigneeId: demoMainId, createdById: demoMainId, areaId: presenterAreaId } });
    await prisma.taskChecklistItem.create({ data: { taskId: task.id, title: 'Conferir dados e evidências', isDone: i%3 === 2, position: 0 } });
    await prisma.taskComment.create({ data: { taskId: task.id, userId: demoMainId, content: 'Exemplo fictício de acompanhamento da execução.' } });
  }
  await prisma.notification.createMany({ data: [
    { companyId, userId: demoMainId, kind: 'INDICATOR_OFF_TARGET', title: 'OEE abaixo da meta', link: '/indicators' },
    { companyId, userId: demoMainId, kind: 'ACTION_OVERDUE', title: 'Plano de ação com prazo vencido', link: '/actions' },
  ] });
  await populatePrize(prisma, companyId, demoMainId, presenterAreaId, allIndIds[0]);
  await populateDemoDetails(prisma, companyId, visitor.id, passwordHash);
  await prisma.appSetting.create({ data: { companyId, key: MARKER, value: new Date().toISOString(), group: 'Demonstração' } });
  return companyId;
}

async function populatePrize(prisma: Prisma.TransactionClient, companyId: string, actor: string, areaId: string, platformIndicatorId: string) {
  const year = new Date().getFullYear(), month = new Date().getMonth()+1;
  const program = await prisma.prizeProgram.create({ data: { companyId, code: 'FD-PREMIO', name: 'Programa de Resultados (Demonstração)', status: 'ACTIVE', periodicity: 'MONTHLY', orgNodeId: areaId, ownerUserId: actor, createdById: actor, defaultRubric: 'PREMIO-DEMO' } });
  const annex = await prisma.prizeAnnex.create({ data: { companyId, programId: program.id, code: 'FD-ANEXO', name: 'Regras da equipe de produção', orgNodeId: areaId, positionRef: 'Equipe de Produção', createdById: actor } });
  const version = await prisma.prizeAnnexVersion.create({ data: { annexId: annex.id, version: 1, status: 'EFFECTIVE', salaryPercent: 30, gainPotential: 1200, approvedAt: new Date(), createdById: actor } });
  await prisma.prizeAnnex.update({ where: { id: annex.id }, data: { currentVersionId: version.id } });
  await prisma.prizeAnnexApproval.create({ data: { annexVersionId: version.id, approverUserId: actor, status: 'APPROVED', decidedById: actor, decidedAt: new Date(), comment: 'Aprovação fictícia para demonstração.' } });
  const indicator = await prisma.prizeIndicator.create({ data: { companyId, programId: program.id, annexVersionId: version.id, code: 'FD-OEE', name: 'Eficiência da produção', unit: '%', weight: 100, direction: 'HIGHER_BETTER', platformIndicatorId, orgNodeId: areaId } });
  await prisma.prizeIndicatorRange.createMany({ data: [ { indicatorId: indicator.id, orderIndex: 0, minLimit: 0, maxLimit: 79.99, gainPercent: 0 }, { indicatorId: indicator.id, orderIndex: 1, minLimit: 80, maxLimit: 89.99, gainPercent: 70 }, { indicatorId: indicator.id, orderIndex: 2, minLimit: 90, maxLimit: 100, gainPercent: 100 } ] });
  const areaRef = await prisma.prizeOrgRef.upsert({ where: { companyId_normalizedKey: { companyId, normalizedKey: 'producao' } }, update: {}, create: { companyId, code: 36001, name: 'Produção', normalizedKey: 'producao', source: 'DEMO', createdById: actor } });
  const cargoRef = await prisma.prizeCargoRef.upsert({ where: { companyId_normalizedKey: { companyId, normalizedKey: 'equipe de producao' } }, update: {}, create: { companyId, code: 36001, name: 'Equipe de Produção', normalizedKey: 'equipe de producao', source: 'DEMO', createdById: actor } });
  const catalog = await prisma.prizeIndicatorCatalog.create({ data: { companyId, code: 'FD-OEE', name: 'Eficiência da produção', unit: '%', platformIndicatorId, source: 'MANUAL', createdById: actor } });
  const group = await prisma.prizeRuleGroup.create({ data: { companyId, annexVersionId: version.id, name: 'Equipe de Produção', areaRefs: ['Produção'], positionRefs: ['Equipe de Produção'], normalizedAreaKeys: ['producao'], normalizedPositionKeys: ['equipe de producao'], areaRefIds: [areaRef.id], cargoRefIds: [cargoRef.id], salaryPercent: 30, createdById: actor } });
  const rule = await prisma.prizeRuleIndicator.create({ data: { companyId, groupId: group.id, catalogId: catalog.id, weight: 100, createdById: actor } });
  for (let offset=2;offset>=0;offset--) {
    const date=new Date(year,month-1-offset,1), y=date.getFullYear(), m=date.getMonth()+1, label=date.toISOString().slice(0,7);
    const competence=await prisma.prizeCompetence.create({ data: { companyId, programId: program.id, year:y, month:m, label, startDate:date, endDate:new Date(y,m,0), status: offset ? 'CLOSED' : 'FILLING', createdById:actor } });
    await prisma.prizeIndicatorParameter.create({ data: { indicatorId: indicator.id, competenceId: competence.id, year:y, month:m, target:90, zero:80, weight:100 } });
    await prisma.prizeActualResult.create({ data: { companyId, competenceId:competence.id, indicatorId:indicator.id, year:y, month:m, realized:95, status:'CLOSED', responsibleUserId:actor, createdById:actor, comment:'Resultado fictício.' } });
    const parameter = await prisma.prizeRuleParameter.create({ data: { companyId, ruleIndicatorId: rule.id, year: y, month: m, zero: 80, target: 90, createdById: actor } });
    await prisma.prizeRuleBand.createMany({ data: [{ companyId, parameterId: parameter.id, orderIndex: 0, minLimit: 0, maxLimit: 79.99, gainPercent: 0 }, { companyId, parameterId: parameter.id, orderIndex: 1, minLimit: 80, maxLimit: 89.99, gainPercent: 70 }, { companyId, parameterId: parameter.id, orderIndex: 2, minLimit: 90, maxLimit: 100, gainPercent: 100 }] });
    await prisma.prizeCatalogActualResult.create({ data: { companyId, competenceId: competence.id, catalogId: catalog.id, year: y, month: m, realized: 95, status: 'CLOSED', closedAt: new Date(), closedById: actor, createdById: actor } });
    await prisma.prizeManualAdjustment.create({ data: { companyId, competenceId: competence.id, registration: 'FD-002', field: 'FINAL_VALUE', previousValue: '1200', newValue: '1080', amount: -120, reason: 'Ajuste fictício de proporcionalidade, refletido na memória.', status: 'APPROVED', requestedById: actor, decidedById: actor, decidedAt: new Date() } });
    const run=await prisma.prizeCalculationRun.create({ data: { companyId, competenceId:competence.id, version:1, status:'SUCCESS', engineVersion:'demo-snapshot-v1', totalEmployees:3, totalGross:3600, totalReductions:120, totalFinal:3480, createdById:actor, finishedAt:new Date(), reason:'Apuração fictícia para exploração da demonstração.' } });
    await prisma.prizeCellResult.create({ data: { companyId, runId: run.id, competenceId: competence.id, groupId: group.id, annexVersionId: version.id, areaRef: 'Produção', positionRef: 'Equipe de Produção', normalizedAreaKey: 'producao', normalizedPositionKey: 'equipe de producao', possibleSalaryPercent: 30, achievedSalaryPercent: 30, weightedGainPercent: 100, details: { demo: true, indicator: 'FD-OEE', realized: 95 } } });
    const batch=await prisma.prizePayrollBatch.create({ data: { companyId, competenceId:competence.id, runId:run.id, code:'FD-'+label, rubric:'PREMIO-DEMO', status:'RECONCILED', totalItems:3, totalValue:3480, generatedAt:new Date(), createdById:actor } });
    for(let i=0;i<3;i++) {
      const registration='FD-00'+(i+1), name=['Ana Exemplo','Bruno Exemplo','Carla Exemplo'][i], reduction=i===1?120:0, finalValue=1200-reduction;
      await prisma.prizeEmployeeSnapshot.create({ data: { companyId, competenceId:competence.id, batchId:batch.id, registration, name, baseSalary:4000, areaRef:'Produção', positionRef:'Equipe de Produção', workedDays:30, createdById:actor, source:'MANUAL' } });
      const result=await prisma.prizeCalculationResult.create({ data: { companyId, runId:run.id, competenceId:competence.id, registration, name, baseSalary:4000, potential:1200, weightedGain:100, proportionality:100, grossValue:1200, totalReductions:reduction, finalValue } });
      await prisma.prizeCalculationLine.createMany({ data: [ { resultId:result.id, step:1, code:'POTENTIAL', label:'Potencial (30% do salário)', value:1200 }, { resultId:result.id, step:2, code:'FINAL', label:'Valor final demonstrativo', value:finalValue } ] });
      await prisma.prizePayrollBatchItem.create({ data: { companyId, batchId:batch.id, registration, name, rubric:'PREMIO-DEMO', value:finalValue, status:'ACCEPTED', calcResultId:result.id } });
      await prisma.prizePayslip.create({ data: { companyId, competenceId:competence.id, calcRunId:run.id, calcResultId:result.id, registration, name, version:1, status:'PUBLISHED', finalValue, publishedAt:new Date(), createdById:actor, data:{ company:{name:'Empresa Demonstração'}, competence:{label,year:y,month:m}, program:{code:program.code,name:program.name,currency:'BRL'}, employee:{registration,name,baseSalary:4000,area:'Produção',position:'Equipe de Produção'}, prize:{potential:1200,weightedGain:100,proportionality:100,grossValue:1200,totalReductions:reduction,finalValue,adjustments:0,gratification:0,blocked:false}, memory:[{step:1,code:'FINAL',label:'Valor final',value:finalValue}], meta:{engineVersion:'demo-snapshot-v1',calcVersion:1,emittedAt:new Date().toISOString()} } } });
    }
  }
}

/** Migra apenas os exemplos locais que usavam a antiga convenção de tolerância. */
async function repairDemoLights(prisma: Prisma.TransactionClient, companyId: string) {
  const key = 'demo.focus.lights.v1';
  if (await prisma.appSetting.findUnique({ where: { companyId_key: { companyId, key } } })) return;
  const indicators = await prisma.indicator.findMany({ where: { companyId, code: { startsWith: 'FD-IND-' } }, include: { results: true, targets: true } });
  for (const indicator of indicators) {
    await prisma.indicator.update({ where: { id: indicator.id }, data: { yellowToleranceP: 90 } });
    for (const result of indicator.results) {
      const target = indicator.targets.find(t => t.periodRef === result.periodRef);
      if (!target) continue;
      const calculated = calcStatus({ value: result.value, target: target.target, direction: indicator.direction as any, yellowToleranceP: 90 });
      await prisma.indicatorResult.update({ where: { id: result.id }, data: calculated });
      await prisma.monthlyMeetingIndicator.updateMany({ where: { indicatorId: indicator.id, meeting: { companyId, periodRef: result.periodRef } }, data: { light: calculated.light, attainment: calculated.attainment, deviationPct: calculated.deviationPct, isCritical: calculated.light === 'RED' } });
    }
  }
  await prisma.appSetting.create({ data: { companyId, key, value: new Date().toISOString(), group: 'Demonstração' } });
}

async function populateDemoDetails(prisma: Prisma.TransactionClient, companyId: string, actor: string, passwordHash: string) {
  const key = 'demo.focus.details.v1';
  if (await prisma.appSetting.findUnique({ where: { companyId_key: { companyId, key } } })) return;
  const areas = await prisma.orgNode.findMany({ where: { companyId, type: 'AREA', deletedAt: null }, orderBy: { position: 'asc' } });
  const people = ['Ana Exemplo', 'Bruno Exemplo', 'Carla Exemplo'];
  const team = [];
  for (const [i, name] of people.entries()) {
    const email = ['ana', 'bruno', 'carla'][i] + '@demonstracao.local';
    const collision = await prisma.user.findUnique({ where: { email } });
    if (collision && collision.companyId !== companyId) throw new Error('Identidade fictícia já pertence a outra empresa.');
    team.push(await prisma.user.upsert({ where: { email }, update: {}, create: { companyId, name, email, passwordHash, role: 'VIEWER', defaultNodeId: areas[i % areas.length]?.id, jobTitle: 'Responsável de área (fictício)' } }));
  }
  const actions = await prisma.actionPlan.findMany({ where: { companyId, description: 'Plano de ação fictício para demonstração.' }, take: 3 });
  for (const [i, action] of actions.entries()) {
    await prisma.actionPlan.update({ where: { id: action.id }, data: { responsibleUserId: team[i].id } });
    await prisma.actionTask.updateMany({ where: { actionId: action.id }, data: { assignedToId: team[i].id } });
  }
  const program = await prisma.prizeProgram.findUnique({ where: { companyId_code: { companyId, code: 'FD-PREMIO' } } });
  if (!program) throw new Error('Programa demonstrativo ausente.');
  await prisma.prizeModeratorRule.create({ data: { companyId, programId: program.id, name: 'Falta: redução demonstrativa', eventType: 'FALTA', criterion: 'PER_OCCURRENCE', reductionPercent: 10, cap: 20, notes: 'Exemplo fictício; nenhum envio à folha real.', createdById: actor } });
  const competences = await prisma.prizeCompetence.findMany({ where: { companyId, programId: program.id } });
  for (const competence of competences) {
    await prisma.prizeEmployeeEvent.create({ data: { companyId, competenceId: competence.id, registration: 'FD-002', type: 'FALTA', days: 1, date: competence.startDate, description: 'Ocorrência fictícia: redução de R$ 120 no exemplo.' } });
    await prisma.prizeException.create({ data: { companyId, competenceId: competence.id, registration: 'FD-003', type: 'TRAINING', reason: 'Exemplo de solicitação em análise, sem efeito na apuração.', status: 'REQUESTED', requestedById: actor } });
    await prisma.prizeTemporaryAllocation.create({ data: { companyId, competenceId: competence.id, registration: 'FD-001', originArea: 'Produção', destArea: 'Logística', days: 5, ruleApplied: 'KEEP_ORIGIN', reason: 'Exemplo fictício de apoio temporário.', createdById: actor } });
    const job = await prisma.prizeIntegrationJob.create({ data: { companyId, competenceId: competence.id, kind: 'APDATA_ELIGIBLE', type: 'MANUAL', status: 'SUCCESS', processed: 3, finishedAt: new Date(), log: 'Lote fictício local, sem conexão externa.', summary: { previousCount: 3, incomingCount: 3, added: [], removed: [], changed: [], unchanged: 3, flags: { missingSalary: [], missingPosition: [], terminated: [] } }, createdById: actor } });
    await prisma.prizeEmployeeSnapshot.updateMany({ where: { companyId, competenceId: competence.id }, data: { batchId: job.id } });
    await prisma.prizeAuditLog.create({ data: { companyId, competenceId: competence.id, userId: actor, action: 'DEMO_DATA_PREPARED', entityType: 'COMPETENCE', entityId: competence.id, justification: 'Histórico fictício para demonstração pública.' } });
  }
  const board = await prisma.taskBoard.findUnique({ where: { key: 'CENTRAL_TRABALHO:' + companyId }, include: { columns: true } });
  if (board) {
    const column = board.columns.find(c => c.statusKey === 'TODO')!;
    for (const [i, member] of team.entries()) {
      const task = await prisma.workspaceTask.create({ data: { companyId, boardId: board.id, columnId: column.id, title: ['Conferir dados de produção', 'Validar análise de desvios', 'Preparar pauta da equipe'][i], assigneeId: member.id, createdById: actor, areaId: member.defaultNodeId, status: 'TODO', priority: 'HIGH', dueDate: new Date(Date.now() + (i-1)*86400000) } });
      await prisma.taskActivity.create({ data: { taskId: task.id, userId: actor, action: 'TASK_CREATED', toValue: task.title } });
      await prisma.taskAttachment.create({ data: { taskId: task.id, uploadedById: actor, fileName: 'Exemplo de acompanhamento', fileUrl: '/indicators' } });
    }
    await prisma.taskBoard.update({ where: { id: board.id }, data: { wikiContent: 'Projeto demonstrativo: conectar o BSC à execução. Acompanhe indicadores, revise desvios, execute os planos de ação e apresente os resultados nas reuniões mensais.' } });
  }
  await prisma.appSetting.create({ data: { companyId, key, value: new Date().toISOString(), group: 'Demonstração' } });
}

client.$transaction(populate, { timeout: 180_000 }).then(companyId => console.log('Demonstração pronta:', companyId)).catch(error => { console.error(error); process.exitCode=1; }).finally(() => client.$disconnect());
