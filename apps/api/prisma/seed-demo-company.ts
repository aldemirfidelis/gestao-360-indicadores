/**
 * Seed da EMPRESA DEMONSTRAÇÃO — empresa fictícia PRÓPRIA (indústria genérica de manufatura).
 *
 * - Estrutura, indicadores e mapa estratégico são definidos AQUI, do zero, de forma enxuta e
 *   coerente (NÃO clona a Goiasa). Tema neutro de indústria/manufatura, aplicável a qualquer
 *   prospect. Valores numéricos aleatórios, dados todos fictícios.
 * - Goiasa é SOMENTE LEITURA (nunca modificada) — usada apenas como guarda/asserção de snapshot.
 *   Toda escrita/deleção é escopada ao companyId da Empresa Demonstração (com guarda explícita).
 * - Idempotente: a cada execução LIMPA os dados da Empresa Demonstração e regenera.
 *
 * Rodar:  pnpm -C apps/api exec tsx prisma/seed-demo-company.ts
 */
import { PrismaClient, UserRoleEnum, Prisma, FormFieldType } from '@prisma/client';
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

// ---------- catálogos dos módulos corporativos ----------
const RISK_POOL = [
  'Falha em equipamento crítico de produção', 'Parada não programada da linha',
  'Não conformidade ambiental em efluentes', 'Acidente de trabalho com afastamento',
  'Atraso na entrega de fornecedores', 'Variação no preço de insumos',
  'Indisponibilidade de mão de obra especializada', 'Falha no fornecimento de insumos',
  'Ruptura de estoque de produto acabado', 'Perda de cliente relevante',
  'Risco de incêndio em área industrial', 'Falha em sistema de TI crítico',
];
const DOC_POOL = [
  'Política de Qualidade', 'Procedimento de Operação da Linha de Produção', 'Instrução de Trabalho - Manutenção',
  'Manual de Segurança Industrial', 'Procedimento de Controle Ambiental', 'Política de Recursos Humanos',
  'Procedimento de Manutenção Preventiva', 'Instrução de Inspeção de Qualidade',
  'Manual de Boas Práticas de Fabricação', 'Procedimento de Expedição', 'Política de Meio Ambiente',
  'Procedimento de Gestão de Não Conformidades',
];
const PROCESS_POOL = [
  'Produção / Manufatura', 'Manutenção Industrial', 'Controle de Qualidade', 'Gestão Ambiental',
  'Vendas e Atendimento', 'Gestão de Pessoas', 'Logística e Expedição', 'Suprimentos e Compras',
  'Planejamento e Controle da Produção (PCP)', 'Gestão Financeira',
];
const AUDIT_POOL = [
  'Auditoria Interna ISO 9001', 'Auditoria Ambiental ISO 14001', 'Auditoria de Segurança do Trabalho',
  'Auditoria de Processos Produtivos', 'Auditoria de Fornecedores', 'Auditoria de Boas Práticas',
];
const FORM_POOL = [
  'Checklist de Inspeção de Segurança', 'Formulário de Análise Crítica', 'Checklist de Partida de Linha',
  'Inspeção de EPI', 'Checklist de Limpeza Industrial', 'Formulário de Registro de Ocorrência',
  'Checklist de Manutenção Preventiva', 'Pesquisa de Clima Organizacional',
];
const SUPPLIERS_POOL = ['Fornecedores de matéria-prima', 'Almoxarifado', 'Suprimentos', 'Laboratório', 'Manutenção'];
const INPUTS_POOL = ['Matéria-prima', 'Insumos', 'Energia elétrica', 'Ordens de produção', 'Ordens de serviço'];
const OUTPUTS_POOL = ['Produto acabado', 'Relatórios de qualidade', 'Pedidos expedidos', 'Registros de processo', 'Subprodutos'];
const CUSTOMERS_POOL = ['Clientes', 'Distribuidores', 'Mercado interno', 'Exportação', 'Áreas internas'];

function randomName() {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

/** Escolhe n itens distintos de um pool e junta um por linha (formato SIPOC / texto livre). */
const pickLines = <T>(a: T[], n: number) => [...new Set(Array.from({ length: n }, () => pick(a)))].join('\n');

/** Valor fictício plausível para a resposta de um campo de formulário, por tipo. */
function answerFor(type: string): string {
  switch (type) {
    case 'BOOLEAN': return pick(['Sim', 'Não']);
    case 'NUMBER': return String(rint(20, 120));
    case 'DATE': return new Date(Date.now() - rint(0, 30) * 86_400_000).toISOString().slice(0, 10);
    case 'SELECT': return pick(['Conforme', 'Não conforme', 'Não aplicável']);
    case 'TEXTAREA': return 'Sem observações relevantes (fictício).';
    default: return randomName();
  }
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
  // Módulos corporativos (FASE 6/7) — apagados ANTES de indicadores/ações/projetos/orgNodes
  // por causa das FKs. Ordem: dependentes primeiro.
  await prisma.formAiSuggestion.deleteMany({ where: { companyId } });
  await prisma.formImportJob.deleteMany({ where: { companyId } });
  await prisma.formExportJob.deleteMany({ where: { companyId } });
  await prisma.formNotificationRule.deleteMany({ where: { companyId } });
  await prisma.formOfflineSyncConflict.deleteMany({ where: { companyId } });
  await prisma.formOfflineSyncQueue.deleteMany({ where: { companyId } });
  await prisma.formKiosk.deleteMany({ where: { companyId } });
  await prisma.formQrCode.deleteMany({ where: { companyId } });
  await prisma.formExternalLink.deleteMany({ where: { companyId } });
  await prisma.formEvidence.deleteMany({ where: { companyId } });
  await prisma.formRecordTimeline.deleteMany({ where: { companyId } });
  await prisma.formRecordCorrection.deleteMany({ where: { companyId } });
  await prisma.formIssue.deleteMany({ where: { companyId } });
  await prisma.formApproval.deleteMany({ where: { companyId } });
  await prisma.formSignature.deleteMany({ where: { companyId } });
  await prisma.formExecutionResponseItem.deleteMany({ where: { companyId } });
  await prisma.formExecutionAssignment.deleteMany({ where: { companyId } });
  await prisma.formOperationalRecord.deleteMany({ where: { companyId } });
  await prisma.formAnswer.deleteMany({ where: { submission: { companyId } } });
  await prisma.formSubmission.deleteMany({ where: { companyId } });
  await prisma.formExecution.deleteMany({ where: { companyId } });
  await prisma.formSchedule.deleteMany({ where: { companyId } });
  await prisma.formPrintLayout.deleteMany({ where: { companyId } });
  await prisma.formPermission.deleteMany({ where: { companyId } });
  await prisma.formWorkflow.deleteMany({ where: { companyId } });
  await prisma.formTemplateFormula.deleteMany({ where: { companyId } });
  await prisma.formTemplateRule.deleteMany({ where: { companyId } });
  await prisma.formReusableBlock.deleteMany({ where: { companyId } });
  await prisma.formFieldOption.deleteMany({ where: { companyId } });
  await prisma.formField.deleteMany({ where: { template: { companyId } } });
  await prisma.formTemplateSection.deleteMany({ where: { companyId } });
  await prisma.formTemplateVersion.deleteMany({ where: { companyId } });
  await prisma.formTemplateTagRelation.deleteMany({ where: { companyId } });
  await prisma.formTemplate.deleteMany({ where: { companyId } });
  await prisma.formRetentionPolicy.deleteMany({ where: { companyId } });
  await prisma.formTag.deleteMany({ where: { companyId } });
  await prisma.formFolder.deleteMany({ where: { companyId } });
  await prisma.formCategory.deleteMany({ where: { companyId } });
  await prisma.formTypeConfig.deleteMany({ where: { companyId } });
  await prisma.audit.deleteMany({ where: { companyId } }); // cascata findings (que referenciam NCs)
  await prisma.nonConformity.deleteMany({ where: { companyId } });
  await prisma.riskRegister.deleteMany({ where: { companyId } });
  await prisma.document.deleteMany({ where: { companyId } });
  await prisma.process.deleteMany({ where: { companyId } }); // cascata steps (+ forms já apagados)
  // Modulos novos (comunicacao, reuniao mensal, food safety, seg. patrimonial) -
  // apagados ANTES de indicadores/acoes/orgnodes por causa das FKs.
  await prisma.communicationPost.deleteMany({ where: { companyId } }); // cascata reads/reactions/comments/pollResponses
  await prisma.communicationCampaign.deleteMany({ where: { companyId } });
  await prisma.communicationMedia.deleteMany({ where: { companyId } });
  await prisma.conversation.deleteMany({ where: { companyId } }); // cascata participants/messages
  await prisma.monthlyMeeting.deleteMany({ where: { companyId } }); // cascata areas/indicadores/agenda/decisoes/etc
  // Food safety (filhos -> pais)
  await prisma.foodSafetyRecallItem.deleteMany({ where: { companyId } });
  await prisma.foodSafetyRecall.deleteMany({ where: { companyId } });
  await prisma.foodSafetyTraceLink.deleteMany({ where: { companyId } });
  await prisma.foodSafetyMonitoringRecord.deleteMany({ where: { companyId } });
  await prisma.foodSafetyControlPlan.deleteMany({ where: { companyId } });
  await prisma.foodSafetyHazard.deleteMany({ where: { companyId } });
  await prisma.foodSafetyLot.deleteMany({ where: { companyId } });
  await prisma.foodSafetyMaterial.deleteMany({ where: { companyId } });
  await prisma.foodSafetySupplier.deleteMany({ where: { companyId } });
  await prisma.foodSafetyProcessStep.deleteMany({ where: { companyId } });
  await prisma.foodSafetyProcess.deleteMany({ where: { companyId } });
  await prisma.foodSafetyRequirementAssessment.deleteMany({ where: { companyId } });
  await prisma.foodSafetyRequirement.deleteMany({ where: { companyId } });
  await prisma.foodSafetyStandardVersion.deleteMany({ where: { companyId } });
  await prisma.foodSafetyStandard.deleteMany({ where: { companyId } });
  await prisma.foodSafetyRiskMatrix.deleteMany({ where: { companyId } });
  await prisma.foodSafetyProgram.deleteMany({ where: { companyId } });
  // Seguranca patrimonial (companyId direto, sem FK entre si)
  await prisma.securityAuditLog.deleteMany({ where: { companyId } });
  await prisma.securityLogBookEntry.deleteMany({ where: { companyId } });
  await prisma.securityShiftHandover.deleteMany({ where: { companyId } });
  await prisma.securityRoundExecution.deleteMany({ where: { companyId } });
  await prisma.securityRoundCheckpoint.deleteMany({ where: { companyId } });
  await prisma.securityRoundRoute.deleteMany({ where: { companyId } });
  await prisma.securityIncident.deleteMany({ where: { companyId } });
  await prisma.securityAccessMovement.deleteMany({ where: { companyId } });
  await prisma.securityAuthorization.deleteMany({ where: { companyId } });
  await prisma.securityDocumentRequirement.deleteMany({ where: { companyId } });
  await prisma.securityVehicle.deleteMany({ where: { companyId } });
  await prisma.securityContractorCompany.deleteMany({ where: { companyId } });
  await prisma.securityPerson.deleteMany({ where: { companyId } });
  await prisma.securityPost.deleteMany({ where: { companyId } });
  await prisma.securityGate.deleteMany({ where: { companyId } });
  await prisma.securityQrCode.deleteMany({ where: { companyId } });
  await prisma.securityPackageActivation.deleteMany({ where: { companyId } });
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
    const yellowToleranceP = 5;
    const created = await prisma.indicator.create({
      data: {
        companyId, ownerNodeId, name: d.name, code: `IND-${String(indSeq).padStart(3, '0')}`,
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
      if (indicatorId) await prisma.strategicObjectiveIndicator.create({ data: { objectiveId: obj.id, indicatorId } }).catch(() => undefined);
    }
    if (ownerNodeId) await prisma.strategicObjectiveOrgNode.create({ data: { objectiveId: obj.id, orgNodeId: ownerNodeId, kind: 'responsavel' } }).catch(() => undefined);
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
    await prisma.objectiveRelation.create({ data: { fromId, toId, weight: 1, kind: 'impacta', label: null } }).catch(() => undefined);
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

  // ---------- módulos corporativos (FASE 6/7) ----------

  // 15) Riscos (RiskRegister)
  const riskTitle = namer([...RISK_POOL]);
  const RISK_CAT = ['STRATEGIC', 'OPERATIONAL', 'OPERATIONAL', 'FINANCIAL', 'COMPLIANCE', 'SAFETY', 'ENVIRONMENTAL', 'QUALITY', 'PROCESS'] as const;
  const RISK_STATUS = ['IDENTIFIED', 'ANALYZING', 'MITIGATING', 'MONITORING', 'ACCEPTED', 'CLOSED'] as const;
  for (let i = 0; i < 8; i++) {
    const status = pick([...RISK_STATUS]);
    const identifiedAt = new Date(Date.now() - rint(10, 200) * 86_400_000);
    await prisma.riskRegister.create({
      data: {
        companyId, orgNodeId: pick(areaIds),
        indicatorId: chance(0.6) ? pick(allIndIds) : null,
        projectId: projectIds.length && chance(0.4) ? pick(projectIds) : null,
        mitigationActionId: actionIds.length && chance(0.4) ? pick(actionIds) : null,
        responsibleUserId: pick(userIds), createdById: pick(userIds),
        title: riskTitle(), description: 'Risco identificado para demonstração.',
        category: pick([...RISK_CAT]), status, probability: rint(1, 5), impact: rint(1, 5),
        mitigationPlan: 'Plano de mitigação fictício (controles e barreiras de proteção).',
        contingencyPlan: chance(0.6) ? 'Plano de contingência fictício para o cenário materializado.' : null,
        dueDate: new Date(identifiedAt.getTime() + rint(30, 180) * 86_400_000),
        identifiedAt,
        closedAt: status === 'CLOSED' ? new Date(identifiedAt.getTime() + rint(20, 120) * 86_400_000) : null,
      },
    });
  }

  // 16) Não conformidades (CAPA)
  const ncTitle = namer([...DEVIATION_POOL, 'Reclamação de cliente', 'Falha em auditoria interna', 'Desvio de procedimento operacional']);
  const NC_SOURCE = ['INDICATOR', 'AUDIT', 'PROCESS', 'CUSTOMER', 'SUPPLIER', 'CHECKLIST', 'INSPECTION', 'MANUAL'] as const;
  const NC_SEV = ['MINOR', 'MAJOR', 'MAJOR', 'CRITICAL'] as const;
  const NC_STATUS = ['OPEN', 'TRIAGE', 'ANALYSIS', 'ACTION', 'VERIFICATION', 'CLOSED'] as const;
  const ncIds: string[] = [];
  for (let i = 0; i < 6; i++) {
    const status = pick([...NC_STATUS]);
    const advanced = ['ANALYSIS', 'ACTION', 'VERIFICATION', 'CLOSED'].includes(status);
    const verifying = ['VERIFICATION', 'CLOSED'].includes(status);
    const identifiedAt = new Date(Date.now() - rint(5, 150) * 86_400_000);
    const nc = await prisma.nonConformity.create({
      data: {
        companyId, number: i + 1, orgNodeId: pick(areaIds),
        indicatorId: chance(0.6) ? pick(allIndIds) : null,
        deviationId: deviationIds.length && chance(0.4) ? pick(deviationIds) : null,
        correctiveActionId: actionIds.length && chance(0.5) ? pick(actionIds) : null,
        responsibleUserId: pick(userIds), createdById: pick(userIds),
        title: ncTitle(), description: 'Não conformidade fictícia para demonstração.',
        source: pick([...NC_SOURCE]), severity: pick([...NC_SEV]), status,
        immediateAction: 'Contenção/disposição imediata aplicada (fictícia).',
        rootCause: advanced ? 'Causa raiz identificada via análise (fictícia).' : null,
        correctivePlan: advanced ? 'Plano de ação corretiva definido (fictício).' : null,
        effectivenessCheck: verifying ? 'Verificação de eficácia realizada após a ação corretiva.' : null,
        effectivenessOk: verifying ? chance(0.7) : null,
        dueDate: new Date(identifiedAt.getTime() + rint(20, 120) * 86_400_000),
        identifiedAt,
        closedAt: status === 'CLOSED' ? new Date(identifiedAt.getTime() + rint(15, 100) * 86_400_000) : null,
      },
      select: { id: true },
    });
    ncIds.push(nc.id);
  }

  // 17) Documentos (Gestão Documental)
  const docTitle = namer([...DOC_POOL]);
  const DOC_TYPE = ['POLICY', 'PROCEDURE', 'PROCEDURE', 'INSTRUCTION', 'MANUAL', 'FORM', 'RECORD'] as const;
  const DOC_STATUS = ['DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED', 'PUBLISHED', 'OBSOLETE'] as const;
  const DOC_PREFIX: Record<string, string> = { POLICY: 'POL', PROCEDURE: 'PRO', INSTRUCTION: 'IT', MANUAL: 'MAN', FORM: 'FOR', TEMPLATE: 'TMP', RECORD: 'REG', EXTERNAL: 'EXT', OTHER: 'DOC' };
  for (let i = 0; i < 10; i++) {
    const type = pick([...DOC_TYPE]);
    const status = pick([...DOC_STATUS]);
    const approved = ['APPROVED', 'PUBLISHED', 'OBSOLETE'].includes(status);
    const published = ['PUBLISHED', 'OBSOLETE'].includes(status);
    const validFrom = published ? new Date(Date.now() - rint(30, 400) * 86_400_000) : null;
    await prisma.document.create({
      data: {
        companyId, number: i + 1, code: `${DOC_PREFIX[type]}-${String(i + 1).padStart(3, '0')}`,
        orgNodeId: pick(areaIds), indicatorId: chance(0.3) ? pick(allIndIds) : null,
        ownerUserId: pick(userIds), approverUserId: approved ? pick(userIds) : null, createdById: pick(userIds),
        title: docTitle(), description: 'Documento fictício para demonstração.',
        type, status, version: rint(1, 4),
        content: '# Documento de Demonstração\n\nConteúdo fictício em **markdown** para fins de demonstração.\n\n1. Objetivo\n2. Aplicação\n3. Responsabilidades\n4. Procedimento',
        changeNote: chance(0.5) ? 'Revisão periódica do documento (fictícia).' : null,
        validFrom, validUntil: validFrom ? new Date(validFrom.getTime() + rint(180, 730) * 86_400_000) : null,
        reviewIntervalMonths: pick([6, 12, 12, 24]),
        approvedAt: approved ? new Date(Date.now() - rint(20, 380) * 86_400_000) : null,
        publishedAt: published ? validFrom : null,
      },
    });
  }

  // 18) Auditorias e achados (Audit + AuditFinding)
  const auditTitle = namer([...AUDIT_POOL]);
  const AUDIT_TYPE = ['INTERNAL', 'INTERNAL', 'EXTERNAL', 'PROCESS', 'SUPPLIER', 'SAFETY', 'QUALITY'] as const;
  const AUDIT_STATUS = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'COMPLETED'] as const;
  const FINDING_TYPE = ['CONFORMITY', 'NONCONFORMITY', 'OBSERVATION', 'OPPORTUNITY'] as const;
  const FINDING_STATUS = ['OPEN', 'IN_TREATMENT', 'CLOSED'] as const;
  const REQ_POOL = ['ISO 9001 - 8.5', 'ISO 14001 - 6.1', 'NR-12', 'Procedimento interno PR-001', 'ISO 45001 - 8.1'];
  for (let i = 0; i < 4; i++) {
    const status = pick([...AUDIT_STATUS]);
    const started = ['IN_PROGRESS', 'COMPLETED'].includes(status);
    const completed = status === 'COMPLETED';
    const plannedDate = new Date(Date.now() - rint(0, 120) * 86_400_000);
    const audit = await prisma.audit.create({
      data: {
        companyId, number: i + 1, orgNodeId: pick(areaIds),
        leadAuditorUserId: pick(userIds), createdById: pick(userIds),
        title: auditTitle(), scope: 'Escopo de auditoria fictício (processos, requisitos e registros).',
        type: pick([...AUDIT_TYPE]), status, plannedDate,
        startedAt: started ? plannedDate : null,
        completedAt: completed ? new Date(plannedDate.getTime() + rint(1, 10) * 86_400_000) : null,
        summary: completed ? 'Conclusão da auditoria: pontos fortes e oportunidades de melhoria identificados (fictício).' : null,
      },
      select: { id: true },
    });
    for (let f = 0; f < rint(2, 4); f++) {
      const ftype = pick([...FINDING_TYPE]);
      const isNc = ftype === 'NONCONFORMITY';
      await prisma.auditFinding.create({
        data: {
          companyId,
          auditId: audit.id,
          nonConformityId: isNc && ncIds.length && chance(0.6) ? pick(ncIds) : null,
          type: ftype, severity: isNc ? pick([...NC_SEV]) : null, status: pick([...FINDING_STATUS]),
          requirement: pick(REQ_POOL), description: 'Constatação de auditoria fictícia para demonstração.',
          evidence: chance(0.7) ? 'Evidência objetiva registrada durante a auditoria (fictícia).' : null,
          recommendation: chance(0.6) ? 'Recomendação de melhoria para o processo auditado (fictícia).' : null,
          dueDate: isNc ? new Date(Date.now() + rint(10, 90) * 86_400_000) : null,
        },
      });
    }
  }

  // 19) Processos e SIPOC (Process + ProcessStep)
  const processName = namer([...PROCESS_POOL]);
  const PROC_TYPE = ['CORE', 'CORE', 'SUPPORT', 'MANAGEMENT'] as const;
  const PROC_STATUS = ['DRAFT', 'ACTIVE', 'ACTIVE', 'UNDER_REVIEW', 'ARCHIVED'] as const;
  const STEP_VERBS = ['Receber', 'Preparar', 'Executar', 'Inspecionar', 'Registrar', 'Aprovar', 'Expedir'];
  for (let i = 0; i < 6; i++) {
    const proc = await prisma.process.create({
      data: {
        companyId, number: i + 1, code: `PR-${String(i + 1).padStart(3, '0')}`,
        orgNodeId: pick(areaIds), indicatorId: chance(0.5) ? pick(allIndIds) : null,
        ownerUserId: pick(userIds), createdById: pick(userIds),
        name: processName(), description: 'Processo mapeado para demonstração.',
        objective: 'Garantir a execução padronizada e eficiente do processo (fictício).',
        type: pick([...PROC_TYPE]), status: pick([...PROC_STATUS]), version: pick(['1.0', '1.1', '2.0']),
        suppliers: pickLines(SUPPLIERS_POOL, rint(2, 3)), inputs: pickLines(INPUTS_POOL, rint(2, 3)),
        outputs: pickLines(OUTPUTS_POOL, rint(2, 3)), customers: pickLines(CUSTOMERS_POOL, rint(2, 3)),
      },
      select: { id: true },
    });
    for (let s = 0; s < rint(3, 5); s++) {
      await prisma.processStep.create({
        data: {
          processId: proc.id, order: s + 1,
          name: `${pick(STEP_VERBS)} ${pick(['materiais', 'produto', 'documentação', 'amostra', 'lote'])}`,
          description: 'Etapa do fluxo do processo (fictícia).', responsible: pick(AREA_POOL),
        },
      });
    }
  }

  // 20) Formulários e checklists (FormTemplate + FormField + FormSubmission + FormAnswer)
  const formTitle = namer([...FORM_POOL]);
  const FORM_TYPE = ['FORM', 'CHECKLIST', 'CHECKLIST', 'INSPECTION', 'AUDIT_CHECKLIST', 'SURVEY'] as const;
  const FORM_STATUS = ['DRAFT', 'ACTIVE', 'ACTIVE', 'ARCHIVED'] as const;
  const SUB_STATUS = ['DRAFT', 'SUBMITTED', 'SUBMITTED', 'REVIEWED'] as const;
  const FIELD_DEFS: { label: string; type: FormFieldType; options?: string }[] = [
    { label: 'Data da verificação', type: 'DATE' },
    { label: 'Responsável pela inspeção', type: 'TEXT' },
    { label: 'Equipamento em conformidade?', type: 'BOOLEAN' },
    { label: 'Temperatura registrada (°C)', type: 'NUMBER' },
    { label: 'Condição geral', type: 'SELECT', options: 'Conforme\nNão conforme\nNão aplicável' },
    { label: 'Observações', type: 'TEXTAREA' },
  ];
  const formTypeConfigs = await Promise.all([
    prisma.formTypeConfig.create({ data: { companyId, code: 'FORM', name: 'Formulario', category: 'FORM', color: '#2563eb', icon: 'FileText', purpose: 'Coleta estruturada de dados.', createdById: pick(userIds) } }),
    prisma.formTypeConfig.create({ data: { companyId, code: 'CHECKLIST', name: 'Checklist', category: 'CHECKLIST', color: '#16a34a', icon: 'ClipboardCheck', purpose: 'Verificacao operacional.', createdById: pick(userIds) } }),
    prisma.formTypeConfig.create({ data: { companyId, code: 'OP_RECORD', name: 'Registro operacional', category: 'OPERATIONAL_RECORD', color: '#f59e0b', icon: 'NotebookTabs', purpose: 'Registro recorrente rastreavel.', createdById: pick(userIds) } }),
  ]);
  const formCategories = await Promise.all(['Operacoes', 'Qualidade', 'Seguranca'].map((name) => prisma.formCategory.create({ data: { companyId, name, active: true } })));
  const formFolder = await prisma.formFolder.create({ data: { companyId, name: 'Biblioteca corporativa', createdById: pick(userIds) } });
  await prisma.formTag.createMany({ data: ['Critico', 'Recorrente', 'Offline'].map((name) => ({ companyId, name })) });
  for (let i = 0; i < 5; i++) {
    const status = pick([...FORM_STATUS]);
    const type = pick([...FORM_TYPE]);
    const templateVersion = pick(['1.0', '1.1', '2.0']);
    const typeConfig = type === 'CHECKLIST' || type === 'INSPECTION' || type === 'AUDIT_CHECKLIST' ? formTypeConfigs[1] : formTypeConfigs[0];
    const template = await prisma.formTemplate.create({
      data: {
        companyId, number: i + 1, code: `FRM-${String(i + 1).padStart(3, '0')}`,
        typeConfigId: typeConfig.id, categoryId: pick(formCategories).id, folderId: formFolder.id,
        orgNodeId: pick(areaIds), indicatorId: chance(0.3) ? pick(allIndIds) : null,
        ownerUserId: pick(userIds), createdById: pick(userIds),
        title: formTitle(), description: 'Modelo de formulário/checklist fictício.',
        purpose: 'Padronizar registros operacionais e manter rastreabilidade.',
        instructions: 'Preencher todos os campos obrigatorios e anexar evidencias quando aplicavel.',
        type, status, version: templateVersion,
        confidentiality: 'INTERNAL', reusable: true, estimatedMinutes: rint(5, 25), tags: chance(0.5) ? ['Recorrente'] : [],
      },
      select: { id: true, title: true, code: true, status: true, version: true, orgNodeId: true, indicatorId: true },
    });
    const chosen = FIELD_DEFS.slice(0, rint(3, FIELD_DEFS.length));
    const section = await prisma.formTemplateSection.create({
      data: { companyId, templateId: template.id, code: `SEC-${i + 1}`, title: 'Dados principais', position: 1 },
    });
    const fields: { id: string; label: string; type: string; code: string | null; order: number }[] = [];
    for (let fi = 0; fi < chosen.length; fi++) {
      const fd = chosen[fi];
      const field = await prisma.formField.create({
        data: {
          templateId: template.id, sectionId: section.id, order: fi + 1, code: `F${String(fi + 1).padStart(2, '0')}`, label: fd.label, type: fd.type,
          required: chance(0.5), options: fd.options ?? null,
          evidenceRequired: chance(0.25), weight: rint(1, 3),
          helpText: chance(0.3) ? 'Campo de preenchimento (fictício).' : null,
        },
        select: { id: true, label: true, type: true, code: true, order: true },
      });
      if (fd.options) {
        await prisma.formFieldOption.createMany({
          data: fd.options.split('\n').map((option, oi) => ({ companyId, fieldId: field.id, label: option, value: option, position: oi + 1 })),
        });
      }
      fields.push(field);
    }
    const version = await prisma.formTemplateVersion.create({
      data: {
        companyId, templateId: template.id, versionNumber: 1, versionLabel: templateVersion,
        code: template.code, status: template.status === 'ACTIVE' ? 'PUBLISHED' : template.status,
        changeReason: 'Versao inicial do seed demo',
        builderSnapshot: { template, fields },
        fieldsSnapshot: fields,
        createdById: pick(userIds),
        publishedAt: template.status === 'ACTIVE' ? new Date() : null,
        publishedById: template.status === 'ACTIVE' ? pick(userIds) : null,
      },
      select: { id: true },
    });
    await prisma.formTemplate.update({ where: { id: template.id }, data: { currentVersionId: version.id } });
    await prisma.formTemplateSection.update({ where: { id: section.id }, data: { templateVersionId: version.id } });
    await prisma.formField.updateMany({ where: { templateId: template.id }, data: { templateVersionId: version.id } });
    const execution = template.status === 'ACTIVE'
      ? await prisma.formExecution.create({
          data: {
            companyId, templateId: template.id, templateVersionId: version.id,
            code: `FEX-${String(i + 1).padStart(4, '0')}`, title: `Execucao - ${template.title}`,
            status: 'IN_PROGRESS', orgNodeId: template.orgNodeId, indicatorId: template.indicatorId,
            assignedToId: pick(userIds), dueDate: new Date(Date.now() + rint(2, 20) * 86_400_000),
            startedAt: new Date(), progress: rint(20, 80), snapshot: { template, fields }, createdById: pick(userIds),
          },
          select: { id: true },
        })
      : null;
    for (let s = 0; s < rint(1, 3); s++) {
      const status = pick([...SUB_STATUS]);
      const submitted = ['SUBMITTED', 'REVIEWED'].includes(status);
      const reviewed = status === 'REVIEWED';
      const submittedAt = submitted ? new Date(Date.now() - rint(1, 60) * 86_400_000) : null;
      const submission = await prisma.formSubmission.create({
        data: {
          companyId, templateId: template.id, templateVersionId: version.id, executionId: execution?.id ?? null,
          code: `FRM-SUB-${String(i + 1).padStart(2, '0')}-${String(s + 1).padStart(2, '0')}`,
          orgNodeId: pick(areaIds),
          indicatorId: chance(0.2) ? pick(allIndIds) : null,
          submittedById: pick(userIds), reviewedById: reviewed ? pick(userIds) : null,
          title: `Preenchimento ${s + 1}`, status,
          notes: chance(0.4) ? 'Observações gerais do preenchimento (fictícias).' : null,
          submittedAt, completedAt: submittedAt, reviewedAt: reviewed && submittedAt ? new Date(submittedAt.getTime() + rint(1, 10) * 86_400_000) : null,
          snapshot: { template, fields }, source: execution ? 'EXECUTION' : 'WEB',
        },
        select: { id: true, status: true, title: true, orgNodeId: true, indicatorId: true, submittedAt: true },
      });
      for (const field of fields) {
        await prisma.formAnswer.create({
          data: { submissionId: submission.id, fieldId: field.id, fieldCode: field.code, fieldLabel: field.label, fieldType: field.type, fieldOrder: field.order, value: answerFor(field.type) },
        });
      }
      if (submitted) {
        const record = await prisma.formOperationalRecord.create({
          data: {
            companyId, templateId: template.id, submissionId: submission.id, executionId: execution?.id ?? null,
            code: `REG-${String(i + 1).padStart(2, '0')}-${String(s + 1).padStart(2, '0')}`,
            title: submission.title ?? template.title, status: reviewed ? 'VALIDATED' : 'COMPLETED',
            recordDate: submission.submittedAt ?? new Date(), orgNodeId: submission.orgNodeId, indicatorId: submission.indicatorId,
            immutableSnapshot: { template, fields }, createdById: pick(userIds),
          },
          select: { id: true },
        });
        await prisma.formRecordTimeline.create({
          data: { companyId, recordId: record.id, submissionId: submission.id, executionId: execution?.id ?? null, entityType: 'FORM_RECORD', entityId: record.id, userId: pick(userIds), action: 'CREATED', title: 'Registro operacional criado' },
        });
        if (reviewed) {
          await prisma.formSignature.create({ data: { companyId, submissionId: submission.id, signerUserId: pick(userIds), signerName: randomName(), method: 'ELECTRONIC' } });
          await prisma.formApproval.create({ data: { companyId, submissionId: submission.id, templateVersionId: version.id, stage: 'FINAL', decision: 'APPROVED', approverUserId: pick(userIds), decidedAt: new Date() } });
        }
      }
    }
  }

  // =====================================================
  // MODULOS NOVOS (interconectados com indicadores/desvios/acoes/areas)
  // =====================================================

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

  // 23) Comunicacao Organizacional (campanha + comunicados + interacoes + midias + chat)
  const allChannels = { platform: true, homeCard: true, myDay: true, qrCode: true, topBanner: false, mandatoryPopup: false, digitalBoard: false, corporateTv: false, email: false, push: false };
  const commCampaign = await prisma.communicationCampaign.create({
    data: {
      companyId, name: 'Campanha Seguranca em Primeiro Lugar', objective: 'Reforcar a cultura de seguranca no dia a dia.',
      category: 'Seguranca', status: 'ACTIVE', ownerId: pick(userIds),
      startsAt: new Date(Date.now() - 20 * 86_400_000), endsAt: new Date(Date.now() + 40 * 86_400_000),
      targetAudience: { scope: 'ALL_COMPANY' }, indicatorIds: allIndIds.slice(0, 2), actionIds: actionIds.slice(0, 2), createdById: pick(userIds),
    },
    select: { id: true },
  });
  const postDefs: Array<{
    title: string; subtitle?: string; content: string; type: 'SIMPLE' | 'BANNER' | 'VIDEO' | 'POLL' | 'SURVEY'; category: string;
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL' | 'URGENT'; status: 'PUBLISHED' | 'SCHEDULED' | 'DRAFT' | 'PENDING_APPROVAL';
    mandatory?: boolean; campaign?: boolean; poll?: any; linkedModule?: string; linkedEntityId?: string;
  }> = [
    { title: 'Atualizacao da Politica de Seguranca do Trabalho', subtitle: 'Leitura obrigatoria para todos os colaboradores', content: 'Prezados(as),\n\nInformamos a atualizacao da Politica de Seguranca do Trabalho, com novas diretrizes para uso de EPIs e bloqueio de equipamentos.\n\nApos a leitura, confirme sua ciencia.', type: 'SIMPLE', category: 'Conformidade', priority: 'HIGH', status: 'PUBLISHED', mandatory: true, campaign: true },
    { title: 'Resultados de Producao do Mes', subtitle: 'Destaques de eficiencia e produtividade', content: 'Confira os destaques do mes:\n\n- Eficiencia produtiva acima da meta\n- Reducao de paradas nao programadas\n- Volume produzido dentro do planejado\n\nParabens a todas as equipes!', type: 'BANNER', category: 'Resultados', priority: 'NORMAL', status: 'PUBLISHED', linkedModule: 'INDICATOR', linkedEntityId: allIndIds[0] },
    { title: 'Treinamento: Boas Praticas de Fabricacao', content: 'Assista ao video de treinamento sobre boas praticas de fabricacao e higiene industrial. A conclusao e obrigatoria para as areas industriais.', type: 'VIDEO', category: 'Treinamento', priority: 'NORMAL', status: 'PUBLISHED' },
    { title: 'Enquete: Clima Organizacional', content: 'Sua opiniao importa! Como voce avalia o ambiente de trabalho na sua area?', type: 'POLL', category: 'Pessoas', priority: 'NORMAL', status: 'PUBLISHED', campaign: true, poll: { question: 'Como voce avalia o ambiente de trabalho na sua area?', type: 'SINGLE', options: [{ id: 'otimo', label: 'Otimo' }, { id: 'bom', label: 'Bom' }, { id: 'regular', label: 'Regular' }, { id: 'ruim', label: 'Ruim' }], anonymous: true, allowMultiple: false, showResults: true } },
    { title: 'Pesquisa de Satisfacao com o Refeitorio', content: 'Ajude-nos a melhorar! Responda a pesquisa sobre a qualidade das refeicoes.', type: 'SURVEY', category: 'Pessoas', priority: 'LOW', status: 'PUBLISHED', poll: { question: 'Qual seu nivel de satisfacao com o refeitorio?', type: 'SINGLE', options: [{ id: 'muito_satisfeito', label: 'Muito satisfeito' }, { id: 'satisfeito', label: 'Satisfeito' }, { id: 'insatisfeito', label: 'Insatisfeito' }], anonymous: false, allowMultiple: false, showResults: true } },
    { title: 'Manutencao Programada da Linha de Producao', subtitle: 'Parada prevista para o proximo fim de semana', content: 'Comunicamos a parada programada da linha de producao para manutencao preventiva. Planejem as atividades das areas dependentes.', type: 'SIMPLE', category: 'Operacional', priority: 'HIGH', status: 'SCHEDULED' },
    { title: 'Rascunho: Programa de Reconhecimento', content: 'Em elaboracao: novo programa de reconhecimento de colaboradores destaque.', type: 'SIMPLE', category: 'Institucional', priority: 'LOW', status: 'DRAFT' },
  ];
  let commSeq = 0;
  for (const def of postDefs) {
    commSeq += 1;
    const published = def.status === 'PUBLISHED';
    const publishedAt = published ? new Date(Date.now() - rint(1, 25) * 86_400_000) : null;
    const post = await prisma.communicationPost.create({
      data: {
        companyId, campaignId: def.campaign ? commCampaign.id : null, title: def.title, subtitle: def.subtitle ?? null,
        content: def.content, type: def.type, category: def.category, priority: def.priority, status: def.status,
        authorId: pick(userIds), approverId: published ? pick(userIds) : null,
        audience: { scope: 'ALL_COMPANY' }, channels: allChannels, poll: def.poll ?? undefined,
        publishAt: def.status === 'SCHEDULED' ? new Date(Date.now() + rint(2, 10) * 86_400_000) : publishedAt,
        publishedAt, expiresAt: published ? new Date(Date.now() + rint(20, 90) * 86_400_000) : null,
        requiresReadConfirmation: Boolean(def.mandatory), requiresPollAnswer: def.type === 'POLL' || def.type === 'SURVEY',
        isMandatory: Boolean(def.mandatory), isPinned: commSeq === 1, isFeatured: commSeq === 2,
        linkedModule: def.linkedModule ?? null, linkedEntityId: def.linkedEntityId ?? null,
        qrCodeValue: `DEMO-COMM-${String(commSeq).padStart(3, '0')}`,
      },
      select: { id: true, type: true, poll: true },
    });
    if (published) {
      const readers = [...new Set(Array.from({ length: rint(2, userIds.length) }, () => pick(userIds)))];
      for (const uid of readers) {
        await prisma.communicationPostRead.create({
          data: { postId: post.id, userId: uid, viewedAt: new Date(Date.now() - rint(0, 20) * 86_400_000), confirmedAt: def.mandatory && chance(0.7) ? new Date(Date.now() - rint(0, 18) * 86_400_000) : null, channel: 'Portal web', device: 'browser' },
        }).catch(() => undefined);
      }
      for (const uid of [...new Set(Array.from({ length: rint(1, 4) }, () => pick(userIds)))]) {
        await prisma.communicationPostReaction.create({ data: { postId: post.id, userId: uid, type: pick(['LIKE', 'UNDERSTOOD', 'IMPORTANT', 'QUESTION'] as const) } }).catch(() => undefined);
      }
      if (chance(0.7)) {
        await prisma.communicationPostComment.create({ data: { postId: post.id, userId: pick(userIds), body: pick(['Obrigado pela informacao!', 'Ja repassei para a equipe.', 'Otima iniciativa.', 'Tenho uma duvida sobre o prazo.']) } });
      }
      if (def.poll) {
        const optionIds = (def.poll.options as Array<{ id: string }>).map((o) => o.id);
        for (const uid of [...new Set(Array.from({ length: rint(2, userIds.length) }, () => pick(userIds)))]) {
          await prisma.communicationPollResponse.create({ data: { postId: post.id, userId: uid, answers: [pick(optionIds)] } }).catch(() => undefined);
        }
      }
    }
  }
  const mediaDefs: Array<{ name: string; type: 'IMAGE' | 'BANNER' | 'VIDEO' | 'PDF'; category: string }> = [
    { name: 'Banner Institucional 2026', type: 'BANNER', category: 'Campanhas' },
    { name: 'Foto Linha de Producao', type: 'IMAGE', category: 'Institucional' },
    { name: 'Video Treinamento BPF', type: 'VIDEO', category: 'Treinamento' },
    { name: 'Cartilha de Seguranca (PDF)', type: 'PDF', category: 'Seguranca' },
    { name: 'Icone Indicadores', type: 'IMAGE', category: 'Geral' },
  ];
  for (let i = 0; i < mediaDefs.length; i++) {
    const md = mediaDefs[i];
    await prisma.communicationMedia.create({
      data: { companyId, name: md.name, type: md.type, category: md.category, tags: ['demo'], ownerAreaId: pick(areaIds), authorId: pick(userIds), status: 'ACTIVE', usageCount: rint(0, 12) },
    });
  }
  // Chat: 2 conversas diretas entre usuarios demo com mensagens
  if (userIds.length >= 2) {
    for (let c = 0; c < 2; c++) {
      const a = userIds[c % userIds.length];
      const b = userIds[(c + 1) % userIds.length];
      if (a === b) continue;
      const dmKey = [a, b].sort().join(':');
      const conv = await prisma.conversation.create({
        data: { companyId, kind: 'DIRECT', dmKey: `${dmKey}:demo${c}`, createdById: a, lastMessageAt: new Date(Date.now() - rint(0, 5) * 3_600_000), lastMessagePreview: 'Combinado, vamos acompanhar.' },
        select: { id: true },
      });
      await prisma.conversationParticipant.createMany({ data: [{ conversationId: conv.id, userId: a, role: 'MEMBER' as const }, { conversationId: conv.id, userId: b, role: 'MEMBER' as const }], skipDuplicates: true });
      const chat = ['Oi, conseguiu ver os resultados do mes?', 'Vi sim, a producao ficou acima da meta.', 'Otimo! Vamos levar isso para a reuniao mensal.', 'Combinado, vamos acompanhar.'];
      for (let m = 0; m < chat.length; m++) {
        await prisma.message.create({ data: { conversationId: conv.id, senderId: m % 2 === 0 ? a : b, body: chat[m], createdAt: new Date(Date.now() - (chat.length - m) * 3_600_000) } });
      }
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
      }).catch(() => undefined);
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
    }).catch(() => undefined);
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
    }).catch(() => undefined);
    prepPos += 1;
  }

  // 25) Seguranca do Alimento (APPCC + cadeia + compliance)
  const fsProgram = await prisma.foodSafetyProgram.create({
    data: { companyId, orgNodeId: pick(areaIds), ownerUserId: pick(userIds), createdById: pick(userIds), code: 'FS-001', name: 'Programa de Seguranca de Alimentos (APPCC)', description: 'Sistema de gestao de seguranca de alimentos da unidade.', scope: 'Producao de alimentos processados.', status: 'ACTIVE' },
    select: { id: true },
  });
  await prisma.foodSafetyRiskMatrix.create({ data: { companyId, name: 'Matriz padrao APPCC', severityScale: 5, probabilityScale: 5, active: true } });
  const fsStepTemplate: Array<{ name: string; type: 'RECEIVING' | 'STORAGE' | 'PROCESSING' | 'PACKAGING' | 'TRANSPORT' | 'DISTRIBUTION'; ccp?: boolean }> = [
    { name: 'Recebimento de materia-prima', type: 'RECEIVING' },
    { name: 'Armazenamento e preparo', type: 'STORAGE' },
    { name: 'Processamento e tratamento', type: 'PROCESSING', ccp: true },
    { name: 'Envase e empacotamento', type: 'PACKAGING', ccp: true },
    { name: 'Expedicao e distribuicao', type: 'DISTRIBUTION' },
  ];
  const fsHazardDefs: Array<{ name: string; category: 'BIOLOGICAL' | 'CHEMICAL' | 'PHYSICAL' | 'ALLERGENIC'; control: 'PRP' | 'OPRP' | 'CCP' }> = [
    { name: 'Contaminacao microbiologica no produto', category: 'BIOLOGICAL', control: 'CCP' },
    { name: 'Residuo quimico de limpeza', category: 'CHEMICAL', control: 'OPRP' },
    { name: 'Particula fisica (metal) no produto', category: 'PHYSICAL', control: 'CCP' },
    { name: 'Contaminacao cruzada de alergenicos', category: 'ALLERGENIC', control: 'PRP' },
  ];
  let fsProcNum = 0;
  let fsHazardNum = 0;
  const fsCcpHazardIds: string[] = [];
  for (const prodName of ['Producao de Bebida Pronta', 'Producao de Alimento Processado']) {
    fsProcNum += 1;
    const proc = await prisma.foodSafetyProcess.create({
      data: { companyId, programId: fsProgram.id, orgNodeId: pick(areaIds), ownerUserId: pick(userIds), createdById: pick(userIds), number: fsProcNum, code: `FSP-${String(fsProcNum).padStart(3, '0')}`, name: prodName, objective: 'Garantir a seguranca do alimento ao longo da producao.', productName: prodName, productionLine: pick(['Linha 1', 'Linha 2']), version: '1.0', status: 'APPROVED' },
      select: { id: true },
    });
    const stepIds: string[] = [];
    let stepNum = 0;
    for (const st of fsStepTemplate) {
      stepNum += 1;
      const step = await prisma.foodSafetyProcessStep.create({
        data: { companyId, processId: proc.id, number: stepNum, code: `S${stepNum}`, name: st.name, type: st.type, isControlPoint: Boolean(st.ccp), inputs: pickLines(INPUTS_POOL, 2), outputs: pickLines(OUTPUTS_POOL, 2) },
        select: { id: true },
      });
      stepIds.push(step.id);
    }
    for (const hz of fsHazardDefs) {
      fsHazardNum += 1;
      const severity = rint(2, 5);
      const probability = rint(1, 5);
      const riskIndex = severity * probability;
      const riskLevel = riskIndex <= 4 ? 'LOW' : riskIndex <= 9 ? 'MODERATE' : riskIndex <= 15 ? 'HIGH' : 'CRITICAL';
      const hazard = await prisma.foodSafetyHazard.create({
        data: { companyId, processId: proc.id, stepId: pick(stepIds), responsibleUserId: pick(userIds), number: fsHazardNum, code: `H${String(fsHazardNum).padStart(3, '0')}`, category: hz.category, name: hz.name, description: 'Perigo avaliado na analise APPCC (ficticio).', source: 'Identificado na analise de perigos.', consequence: 'Risco a seguranca do alimento.', severity, probability, riskIndex, riskLevel: riskLevel as any, controlType: hz.control, existingControls: 'Controles operacionais e PPRs aplicados.', status: 'ASSESSED' },
        select: { id: true, controlType: true },
      });
      if (hz.control === 'CCP') fsCcpHazardIds.push(hazard.id);
    }
  }
  for (const hazardId of fsCcpHazardIds.slice(0, 4)) {
    const plan = await prisma.foodSafetyControlPlan.create({
      data: { companyId, hazardId, responsibleUserId: pick(userIds), controlType: 'CCP', parameter: pick(['Temperatura', 'pH', 'Tempo de retencao', 'Deteccao de metais']), unit: pick(['C', 'pH', 'min', 'ppm']), criticalMin: 60, criticalMax: 85, alertMin: 65, alertMax: 80, method: 'Medicao automatica em linha', instrument: pick(['Termometro digital', 'Detector de metais', 'pHmetro']), frequency: pick(['A cada lote', 'A cada 1h', 'Continuo']), correctiveAction: 'Bloquear lote e abrir nao conformidade.', requiresLotBlock: true, requiresNonConformity: true, status: 'ACTIVE' },
      select: { id: true },
    });
    for (let r = 0; r < rint(3, 5); r++) {
      const result = pick(['OK', 'OK', 'OK', 'ALERT', 'OUT'] as const);
      await prisma.foodSafetyMonitoringRecord.create({
        data: { companyId, controlPlanId: plan.id, recordedById: pick(userIds), measuredAt: new Date(Date.now() - rint(0, 25) * 86_400_000), valueNum: round2(rfloat(58, 88)), result, notes: result === 'OUT' ? 'Valor fora do limite critico; lote bloqueado.' : null, lotBlocked: result === 'OUT' },
      });
    }
  }
  const fsStandard = await prisma.foodSafetyStandard.create({ data: { companyId, code: 'ISO22000', name: 'ISO 22000 - Sistemas de Gestao de Seguranca de Alimentos', origin: 'ISO', active: true }, select: { id: true } });
  const fsStdVersion = await prisma.foodSafetyStandardVersion.create({ data: { companyId, standardId: fsStandard.id, versionLabel: '2018', effectiveDate: new Date(year - 1, 0, 1), status: 'ACTIVE' }, select: { id: true } });
  const fsReqDefs = [
    { chapter: '7', title: 'Programas de pre-requisito (PPR)' },
    { chapter: '8', title: 'Controle operacional e plano APPCC' },
    { chapter: '9', title: 'Avaliacao de desempenho e monitoramento' },
  ];
  let fsReqNum = 0;
  for (const rq of fsReqDefs) {
    fsReqNum += 1;
    const req = await prisma.foodSafetyRequirement.create({
      data: { companyId, standardVersionId: fsStdVersion.id, responsibleUserId: pick(userIds), code: `REQ-${fsReqNum}`, chapter: rq.chapter, item: `${rq.chapter}.${rint(1, 4)}`, title: rq.title, description: 'Requisito normativo aplicavel (ficticio).', criticality: pick(['LOW', 'MEDIUM', 'HIGH'] as const), active: true },
      select: { id: true },
    });
    await prisma.foodSafetyRequirementAssessment.create({ data: { companyId, requirementId: req.id, responsibleUserId: pick(userIds), result: pick(['MET', 'MET', 'PARTIAL', 'NOT_MET'] as const), evidence: 'Evidencia documental anexada (ficticia).', assessedAt: new Date(Date.now() - rint(5, 60) * 86_400_000), nextAssessmentAt: new Date(Date.now() + rint(60, 180) * 86_400_000) } });
  }
  const fsSupplierIds: string[] = [];
  for (let i = 0; i < 2; i++) {
    const sup = await prisma.foodSafetySupplier.create({
      data: { companyId, programId: fsProgram.id, orgNodeId: pick(areaIds), responsibleUserId: pick(userIds), code: `SUP-${String(i + 1).padStart(3, '0')}`, name: pick(['Fornecedor de Materia-prima Vale Verde', 'Insumos Alimenticios Industriais Ltda', 'Embalagens Sustentaveis SA']), suppliedCategories: 'Materia-prima e insumos', criticality: pick(['MEDIUM', 'HIGH', 'CRITICAL'] as const), status: pick(['APPROVED', 'CONDITIONAL'] as const), score: round2(rfloat(60, 98)), lastAuditAt: new Date(Date.now() - rint(30, 200) * 86_400_000) },
      select: { id: true },
    });
    fsSupplierIds.push(sup.id);
  }
  const fsMaterialIds: string[] = [];
  for (let i = 0; i < 3; i++) {
    const mat = await prisma.foodSafetyMaterial.create({
      data: { companyId, programId: fsProgram.id, supplierId: pick(fsSupplierIds), code: `MAT-${String(i + 1).padStart(3, '0')}`, name: pick(['Materia-prima vegetal', 'Aditivo alimentar', 'Conservante', 'Embalagem PET']), category: pick(['RAW_MATERIAL', 'INGREDIENT', 'PACKAGING'] as const), unit: pick(['t', 'kg', 'L', 'un']), shelfLifeDays: rint(30, 365), status: 'ACTIVE' },
      select: { id: true },
    });
    fsMaterialIds.push(mat.id);
  }
  const fsLotIds: string[] = [];
  for (let i = 0; i < 4; i++) {
    const lot = await prisma.foodSafetyLot.create({
      data: { companyId, programId: fsProgram.id, materialId: pick(fsMaterialIds), supplierId: pick(fsSupplierIds), code: `LOTE-${year}-${String(i + 1).padStart(4, '0')}`, type: pick(['RECEIVED', 'PRODUCED'] as const), status: pick(['RELEASED', 'QUARANTINED', 'RELEASED'] as const), quantity: round2(rfloat(100, 5000)), unit: pick(['t', 'kg', 'L']), receivedAt: new Date(Date.now() - rint(5, 60) * 86_400_000), storageLocation: pick(['Silo 1', 'Tanque A', 'Armazem 3']) },
      select: { id: true },
    });
    fsLotIds.push(lot.id);
  }
  for (let i = 1; i < fsLotIds.length; i++) {
    await prisma.foodSafetyTraceLink.create({ data: { companyId, fromLotId: fsLotIds[i - 1], toLotId: fsLotIds[i], eventType: pick(['PRODUCTION', 'TRANSFER', 'CONSUMPTION'] as const), quantity: round2(rfloat(50, 500)), unit: 't' } });
  }

  // 26) Seguranca Patrimonial (acessos, autorizacoes, ocorrencias, rondas, turnos)
  await prisma.securityPackageActivation.create({ data: { companyId, code: 'asset-security', status: 'ENABLED', enabledFeatures: ['gates', 'access', 'rounds', 'incidents', 'handover', 'logbook'], activatedAt: new Date(Date.now() - 90 * 86_400_000) } });
  const secGateIds: string[] = [];
  for (let i = 0; i < 2; i++) {
    const gate = await prisma.securityGate.create({
      data: { companyId, branchId: branch.id, code: `PORT-${i + 1}`, name: pick(['Portaria Principal', 'Portaria de Cargas', 'Portaria de Visitantes']), type: pick(['PEDESTRIAN', 'VEHICLE', 'MIXED']), location: pick(['Entrada principal', 'Doca de cargas']), allowedAccessTypes: ['PERSON', 'VEHICLE'], status: 'ACTIVE' },
      select: { id: true },
    });
    secGateIds.push(gate.id);
  }
  const secPostIds: string[] = [];
  for (let i = 0; i < 3; i++) {
    const post = await prisma.securityPost.create({
      data: { companyId, gateId: pick(secGateIds), code: `PV-${String(i + 1).padStart(2, '0')}`, name: `Posto de Vigilancia ${i + 1}`, location: pick(['Portaria', 'Perimetro', 'Area industrial']), type: pick(['FIXED', 'MOBILE']), criticality: pick(['MEDIUM', 'HIGH']), responsibleUserId: pick(userIds), status: 'ACTIVE' },
      select: { id: true },
    });
    secPostIds.push(post.id);
  }
  const contractorIds: string[] = [];
  for (let i = 0; i < 2; i++) {
    const cc = await prisma.securityContractorCompany.create({
      data: { companyId, legalName: pick(['Manutencao Industrial Beta Ltda', 'Construtora Industrial Alfa SA', 'Transportes Rapidos ME']), tradeName: pick(['Beta Manutencao', 'Construir Alfa', 'Trans Rapido']), cnpj: `${rint(10, 99)}.${rint(100, 999)}.${rint(100, 999)}/000${i + 1}-${rint(10, 99)}`, contractCode: `CTR-${year}-${i + 1}`, serviceTypes: ['Manutencao', 'Transporte'], documentStatus: pick(['VALID', 'EXPIRING'] as const), status: 'ACTIVE' },
      select: { id: true },
    });
    contractorIds.push(cc.id);
  }
  const personIds: string[] = [];
  for (let i = 0; i < 6; i++) {
    const type = pick(['VISITOR', 'CONTRACTOR', 'DRIVER', 'SUPPLIER'] as const);
    const person = await prisma.securityPerson.create({
      data: { companyId, type, code: `PES-${String(i + 1).padStart(3, '0')}`, name: randomName(), documentType: 'CPF', documentNumber: `${rint(100, 999)}.${rint(100, 999)}.${rint(100, 999)}-${rint(10, 99)}`, contractorCompanyId: type === 'CONTRACTOR' || type === 'DRIVER' ? pick(contractorIds) : null, jobTitle: pick(JOB_POOL), documentStatus: pick(['VALID', 'EXPIRING', 'NOT_REQUIRED'] as const), status: 'ACTIVE' },
      select: { id: true },
    });
    personIds.push(person.id);
  }
  const vehicleIds: string[] = [];
  for (let i = 0; i < 3; i++) {
    const v = await prisma.securityVehicle.create({
      data: { companyId, type: pick(['CAR', 'TRUCK', 'MOTORCYCLE']), plate: `${pick(['ABC', 'XYZ', 'QRS', 'JKL'])}${rint(1, 9)}${pick(['A', 'B', 'C', 'D'])}${rint(10, 99)}`, model: pick(['Caminhao Truck', 'Utilitario', 'Carro de passeio']), brand: pick(['Scania', 'Volvo', 'Fiat', 'VW']), color: pick(['Branco', 'Prata', 'Vermelho']), companyName: pick(['Beta Manutencao', 'Trans Rapido']), defaultDriverPersonId: pick(personIds), documentStatus: pick(['VALID', 'EXPIRING'] as const), status: 'ACTIVE' },
      select: { id: true },
    });
    vehicleIds.push(v.id);
  }
  await prisma.securityDocumentRequirement.create({ data: { companyId, scopeType: 'PERSON_TYPE', personType: 'CONTRACTOR', name: 'ASO valido', documentKind: 'ASO', required: true, blockOnMissing: true, warningDays: 30, status: 'ACTIVE' } });
  await prisma.securityDocumentRequirement.create({ data: { companyId, scopeType: 'VEHICLE_TYPE', vehicleType: 'TRUCK', name: 'CRLV atualizado', documentKind: 'CRLV', required: true, blockOnMissing: false, warningDays: 30, status: 'ACTIVE' } });
  let secAuthSeq = 0;
  const authIds: string[] = [];
  for (let i = 0; i < 3; i++) {
    secAuthSeq += 1;
    const status = pick(['APPROVED', 'WAITING_APPROVAL', 'USED'] as const);
    const auth = await prisma.securityAuthorization.create({
      data: { companyId, code: `AUT-${year}-${String(secAuthSeq).padStart(4, '0')}`, personId: pick(personIds), contractorCompanyId: pick(contractorIds), gateId: pick(secGateIds), vehicleId: chance(0.5) ? pick(vehicleIds) : null, status, reason: pick(['Manutencao programada', 'Entrega de insumos', 'Visita tecnica', 'Coleta de residuos']), scheduledStartAt: new Date(Date.now() + rint(-5, 5) * 86_400_000), scheduledEndAt: new Date(Date.now() + rint(6, 12) * 86_400_000), maxStayMinutes: rint(60, 480), approverId: status !== 'WAITING_APPROVAL' ? pick(userIds) : null, approvedAt: status !== 'WAITING_APPROVAL' ? new Date(Date.now() - rint(1, 5) * 86_400_000) : null },
      select: { id: true },
    });
    authIds.push(auth.id);
  }
  let secMovSeq = 0;
  for (let i = 0; i < 6; i++) {
    secMovSeq += 1;
    const movementType = pick(['PERSON_ENTRY', 'PERSON_EXIT', 'VEHICLE_ENTRY', 'VEHICLE_EXIT', 'MATERIAL_ENTRY'] as const);
    const closed = chance(0.6);
    const entryAt = new Date(Date.now() - rint(0, 10) * 86_400_000 - rint(0, 8) * 3_600_000);
    await prisma.securityAccessMovement.create({
      data: { companyId, gateId: pick(secGateIds), postId: pick(secPostIds), authorizationId: chance(0.6) ? pick(authIds) : null, personId: pick(personIds), vehicleId: movementType.startsWith('VEHICLE') ? pick(vehicleIds) : null, code: `MOV-${year}-${String(secMovSeq).padStart(4, '0')}`, movementType, reason: pick(['Manutencao', 'Entrega', 'Visita', 'Coleta']), entryAt, exitAt: closed ? new Date(entryAt.getTime() + rint(30, 300) * 60_000) : null, status: closed ? 'CLOSED' : 'OPEN', registeredById: pick(userIds) },
    });
  }
  let secIncSeq = 0;
  for (let i = 0; i < 3; i++) {
    secIncSeq += 1;
    const status = pick(['OPEN', 'IN_PROGRESS', 'CLOSED'] as const);
    await prisma.securityIncident.create({
      data: { companyId, gateId: pick(secGateIds), postId: pick(secPostIds), actionPlanId: chance(0.4) && actionIds.length ? pick(actionIds) : null, code: `OCO-${year}-${String(secIncSeq).padStart(4, '0')}`, title: pick(['Tentativa de acesso nao autorizado', 'Avaria em cerca do perimetro', 'Veiculo sem documentacao', 'Alarme de intrusao acionado']), type: pick(['ACCESS', 'PERIMETER', 'THEFT', 'SAFETY']), severity: pick(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const), status, description: 'Ocorrencia registrada pela equipe de seguranca (ficticia).', immediateAction: 'Acionamento da supervisao e isolamento da area.', responsibleUserId: pick(userIds), dueAt: new Date(Date.now() + rint(2, 15) * 86_400_000), closedAt: status === 'CLOSED' ? new Date(Date.now() - rint(1, 10) * 86_400_000) : null, createdById: pick(userIds) },
    });
  }
  const route = await prisma.securityRoundRoute.create({ data: { companyId, gateId: pick(secGateIds), code: 'RND-001', name: 'Ronda do Perimetro Industrial', description: 'Ronda noturna pelo perimetro e areas criticas.', frequencyMinutes: 120, toleranceMinutes: 15, responsibleUserId: pick(userIds), status: 'ACTIVE' }, select: { id: true } });
  const checkpointIds: string[] = [];
  for (let i = 0; i < 4; i++) {
    const cp = await prisma.securityRoundCheckpoint.create({ data: { companyId, routeId: route.id, postId: pick(secPostIds), code: `CHK-${i + 1}`, name: pick(['Portao Norte', 'Patio de Tanques', 'Subestacao', 'Almoxarifado', 'Doca de Cargas']), position: i, requiredEvidence: chance(0.5), status: 'ACTIVE' }, select: { id: true } });
    checkpointIds.push(cp.id);
  }
  for (let i = 0; i < 3; i++) {
    const status = pick(['DONE', 'DONE', 'IN_PROGRESS', 'LATE'] as const);
    const startedAt = new Date(Date.now() - rint(0, 7) * 86_400_000 - rint(0, 6) * 3_600_000);
    const visited = status === 'DONE' ? checkpointIds : checkpointIds.slice(0, rint(1, checkpointIds.length));
    await prisma.securityRoundExecution.create({
      data: { companyId, routeId: route.id, postId: pick(secPostIds), assignedUserId: pick(userIds), startedById: pick(userIds), scheduledAt: startedAt, startedAt, finishedAt: status === 'DONE' ? new Date(startedAt.getTime() + 90 * 60_000) : null, status, visitedCheckpointIds: visited, missedCheckpointIds: checkpointIds.filter((c) => !visited.includes(c)) },
    });
  }
  for (let i = 0; i < 2; i++) {
    const startedAt = new Date(Date.now() - rint(0, 5) * 86_400_000);
    await prisma.securityShiftHandover.create({
      data: { companyId, gateId: pick(secGateIds), postId: pick(secPostIds), outgoingUserId: pick(userIds), incomingUserId: pick(userIds), shiftName: pick(['Turno A', 'Turno B', 'Turno C']), startedAt, finishedAt: new Date(startedAt.getTime() + 30 * 60_000), status: pick(['COMPLETED', 'COMPLETED_WITH_PENDING'] as const), summary: 'Passagem de turno sem ocorrencias graves; pendencias registradas no livro.', acceptedAt: new Date(startedAt.getTime() + 35 * 60_000), acceptedById: pick(userIds) },
    });
  }
  for (let i = 0; i < 4; i++) {
    await prisma.securityLogBookEntry.create({
      data: { companyId, gateId: pick(secGateIds), postId: pick(secPostIds), occurredAt: new Date(Date.now() - rint(0, 10) * 86_400_000), title: pick(['Inspecao de rotina', 'Visita da supervisao', 'Teste de alarme', 'Registro de pendencia de turno']), entryType: pick(['ROUTINE', 'INSPECTION', 'INCIDENT', 'NOTE']), description: 'Registro do livro de ocorrencias da seguranca (ficticio).', status: 'ACTIVE', createdById: pick(userIds) },
    });
  }

  console.log('\n=== MODULOS NOVOS (Empresa Demonstracao) ===');
  console.log(`Comunicacao: ${postDefs.length} comunicados, ${mediaDefs.length} midias, 1 campanha, 2 conversas`);
  console.log(`Reuniao mensal: 2 reunioes (1 fechada completa + 1 em preparacao)`);
  console.log(`Food safety: 1 programa, ${fsProcNum} processos, ${fsHazardNum} perigos, ${fsLotIds.length} lotes`);
  console.log(`Seg. patrimonial: ${secGateIds.length} portarias, ${personIds.length} pessoas, ${vehicleIds.length} veiculos, rondas e ocorrencias`);
  console.log(`Analises de causa: ${analysisActions.length} planos com Ishikawa/5 Porques/PDCA`);

  // 21) Resumo + verificação de que a Goiasa não mudou
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
  const [orgNode, branch, user, indicator, indicatorTarget, indicatorResult, strategicMap, perspective, strategicObjective, actionPlan, deviation, meeting, project, okrCycle, orgJob, orgEmployee, risk, nonConformity, document, audit, auditFinding, process, formTemplate, formSubmission] = await Promise.all([
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
    prisma.riskRegister.count({ where: { companyId, deletedAt: null } }),
    prisma.nonConformity.count({ where: { companyId, deletedAt: null } }),
    prisma.document.count({ where: { companyId, deletedAt: null } }),
    prisma.audit.count({ where: { companyId, deletedAt: null } }),
    prisma.auditFinding.count({ where: { audit: { companyId } } }),
    prisma.process.count({ where: { companyId, deletedAt: null } }),
    prisma.formTemplate.count({ where: { companyId, deletedAt: null } }),
    prisma.formSubmission.count({ where: { companyId, deletedAt: null } }),
  ]);
  return { orgNode, branch, user, indicator, indicatorTarget, indicatorResult, strategicMap, perspective, strategicObjective, actionPlan, deviation, meeting, project, okrCycle, orgJob, orgEmployee, risk, nonConformity, document, audit, auditFinding, process, formTemplate, formSubmission };
}

main()
  .catch((e) => { console.error('SEED DEMO ERROR', e); process.exit(1); })
  .finally(() => prisma.$disconnect());

