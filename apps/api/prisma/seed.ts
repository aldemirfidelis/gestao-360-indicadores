/* eslint-disable no-console */
import { PrismaClient, OrgNodeType, IndicatorType, IndicatorUnit, Periodicity, Direction, FeedKind, IndicatorStatus, ActionStatus, ActionPriority, ActionOrigin, DeviationSeverity, DeviationStatus, AnalysisMethod, PerspectiveKind, ObjectiveStatus, TrafficLight, UserRoleEnum } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { calcStatus } from '@g360/shared';
import { dateToPeriodRef, lastNPeriodRefs, periodRefToDate } from '../src/modules/indicators/period.util';
import { PERMISSION_CATALOG, DEFAULT_PROFILES } from '../src/modules/users/permission-catalog';
import { PLATFORM_MODULES, PLATFORM_PERMISSIONS, PLATFORM_PLANS, PLATFORM_ROLES } from '../src/modules/platform-admin/platform-admin.catalog';

const prisma = new PrismaClient();

const rand = (min: number, max: number) => Math.random() * (max - min) + min;
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
const pick = <T>(arr: T[]): T => arr[randInt(0, arr.length - 1)];

interface IndicatorSeed {
  name: string;
  code: string;
  type: IndicatorType;
  unit: IndicatorUnit;
  unitLabel?: string;
  direction: Direction;
  description: string;
  baseTarget: number;
  noisePct: number;          // % de variacao do realizado em torno da meta
  badBiasPct?: number;       // tendencia (positiva = puxa pra cima, negativa = pra baixo)
  ownerAreaName: string;
  perspective: PerspectiveKind;
  weight?: number;
}

const indicatorSeeds: IndicatorSeed[] = [
  { name: 'Absenteismo', code: 'RH-001', type: IndicatorType.HR, unit: IndicatorUnit.PERCENT, direction: Direction.LOWER_BETTER, description: 'Faltas e atrasos sobre horas trabalhadas', baseTarget: 2.5, noisePct: 25, badBiasPct: 8, ownerAreaName: 'RH', perspective: PerspectiveKind.PEOPLE, weight: 2 },
  { name: 'Turnover', code: 'RH-002', type: IndicatorType.HR, unit: IndicatorUnit.PERCENT, direction: Direction.LOWER_BETTER, description: 'Rotatividade mensal de pessoal', baseTarget: 1.8, noisePct: 30, badBiasPct: 10, ownerAreaName: 'RH', perspective: PerspectiveKind.PEOPLE, weight: 2 },
  { name: 'Horas de Treinamento por Colaborador', code: 'RH-003', type: IndicatorType.HR, unit: IndicatorUnit.HOURS, direction: Direction.HIGHER_BETTER, description: 'Horas medias de capacitacao', baseTarget: 6, noisePct: 35, ownerAreaName: 'RH', perspective: PerspectiveKind.LEARNING_GROWTH },
  { name: 'Acidentes com Afastamento', code: 'SST-001', type: IndicatorType.SAFETY, unit: IndicatorUnit.QUANTITY, unitLabel: 'ocorr.', direction: Direction.LOWER_BETTER, description: 'Numero de acidentes com afastamento no mes', baseTarget: 0, noisePct: 100, badBiasPct: 15, ownerAreaName: 'Seguranca do Trabalho', perspective: PerspectiveKind.SAFETY, weight: 3 },
  { name: 'Produtividade Industrial', code: 'PROD-001', type: IndicatorType.PRODUCTION, unit: IndicatorUnit.PERCENT, direction: Direction.HIGHER_BETTER, description: 'Eficiencia de producao planejada x realizada', baseTarget: 92, noisePct: 6, ownerAreaName: 'Producao', perspective: PerspectiveKind.PRODUCTIVITY, weight: 3 },
  { name: 'Eficiencia Operacional (OEE)', code: 'PROD-002', type: IndicatorType.PRODUCTION, unit: IndicatorUnit.PERCENT, direction: Direction.HIGHER_BETTER, description: 'Disponibilidade x performance x qualidade', baseTarget: 78, noisePct: 8, badBiasPct: -3, ownerAreaName: 'Producao', perspective: PerspectiveKind.PRODUCTIVITY },
  { name: 'Custo por Tonelada', code: 'FIN-001', type: IndicatorType.FINANCE, unit: IndicatorUnit.CURRENCY, unitLabel: 'R$/t', direction: Direction.LOWER_BETTER, description: 'Custo de transformacao por tonelada produzida', baseTarget: 540, noisePct: 6, ownerAreaName: 'Producao', perspective: PerspectiveKind.COSTS, weight: 2 },
  { name: 'Consumo de Energia por Tonelada', code: 'PROD-003', type: IndicatorType.PRODUCTION, unit: IndicatorUnit.QUANTITY, unitLabel: 'kWh/t', direction: Direction.LOWER_BETTER, description: 'Eficiencia energetica do processo', baseTarget: 120, noisePct: 8, ownerAreaName: 'Producao', perspective: PerspectiveKind.ESG },
  { name: 'Cumprimento do Plano de Manutencao', code: 'MAN-001', type: IndicatorType.MAINTENANCE, unit: IndicatorUnit.PERCENT, direction: Direction.HIGHER_BETTER, description: 'OS preventivas concluídas no prazo', baseTarget: 95, noisePct: 7, ownerAreaName: 'Manutencao', perspective: PerspectiveKind.INTERNAL_PROCESS },
  { name: 'Atendimento de Requisicoes', code: 'SUP-001', type: IndicatorType.PROCUREMENT, unit: IndicatorUnit.PERCENT, direction: Direction.HIGHER_BETTER, description: 'Requisicoes atendidas no prazo', baseTarget: 90, noisePct: 8, ownerAreaName: 'Suprimentos', perspective: PerspectiveKind.INTERNAL_PROCESS },
  { name: 'Prazo Medio de Compras', code: 'SUP-002', type: IndicatorType.PROCUREMENT, unit: IndicatorUnit.DAYS, direction: Direction.LOWER_BETTER, description: 'Dias entre requisicao e recebimento', baseTarget: 7, noisePct: 18, badBiasPct: 5, ownerAreaName: 'Suprimentos', perspective: PerspectiveKind.INTERNAL_PROCESS },
  { name: 'Indice de Qualidade', code: 'QUA-001', type: IndicatorType.QUALITY, unit: IndicatorUnit.PERCENT, direction: Direction.HIGHER_BETTER, description: 'Conformidade dos lotes auditados', baseTarget: 98, noisePct: 2.5, ownerAreaName: 'Qualidade', perspective: PerspectiveKind.QUALITY, weight: 2 },
  { name: 'Reclamacoes Internas', code: 'QUA-002', type: IndicatorType.QUALITY, unit: IndicatorUnit.QUANTITY, unitLabel: 'casos', direction: Direction.LOWER_BETTER, description: 'Reclamações registradas por outras áreas', baseTarget: 3, noisePct: 60, ownerAreaName: 'Qualidade', perspective: PerspectiveKind.QUALITY },
  { name: 'Acoes Vencidas', code: 'GES-001', type: IndicatorType.OPERATIONAL, unit: IndicatorUnit.QUANTITY, unitLabel: 'acoes', direction: Direction.LOWER_BETTER, description: 'Quantidade de ações em atraso ao final do mês', baseTarget: 5, noisePct: 50, badBiasPct: 20, ownerAreaName: 'Diretoria', perspective: PerspectiveKind.INTERNAL_PROCESS },
  { name: 'Projetos no Prazo', code: 'GES-002', type: IndicatorType.PROJECT, unit: IndicatorUnit.PERCENT, direction: Direction.HIGHER_BETTER, description: 'Projetos estratégicos no prazo planejado', baseTarget: 80, noisePct: 12, badBiasPct: -5, ownerAreaName: 'Diretoria', perspective: PerspectiveKind.INTERNAL_PROCESS },
];

async function main() {
  console.log('[seed] limpando dados existentes...');
  await prisma.$transaction([
    prisma.platformAdminRolePermission.deleteMany(),
    prisma.platformAdminUserRole.deleteMany(),
    prisma.platformAdminSession.deleteMany(),
    prisma.platformAccessLog.deleteMany(),
    prisma.platformAuditLog.deleteMany(),
    prisma.platformAdminUser.deleteMany(),
    prisma.platformAdminRole.deleteMany(),
    prisma.platformAdminPermission.deleteMany(),
    prisma.platformCompanyModuleHistory.deleteMany(),
    prisma.platformCompanyModule.deleteMany(),
    prisma.platformFeatureFlagTarget.deleteMany(),
    prisma.platformSupportSession.deleteMany(),
    prisma.platformPlanModule.deleteMany(),
    prisma.platformCompanyPlanOverride.deleteMany(),
    prisma.platformContract.deleteMany(),
    prisma.platformCompanyStatusHistory.deleteMany(),
    prisma.platformCompanyProfile.deleteMany(),
    prisma.platformPlan.deleteMany(),
    prisma.platformModuleCatalog.deleteMany(),
    prisma.platformRelease.deleteMany(),
    prisma.platformEnvironment.deleteMany(),
    prisma.platformMigrationRecord.deleteMany(),
    prisma.platformBackup.deleteMany(),
    prisma.platformIntegrationConfig.deleteMany(),
    prisma.platformJob.deleteMany(),
    prisma.platformHealthCheck.deleteMany(),
    prisma.documentTagRelation.deleteMany(),
    prisma.documentTag.deleteMany(),
    prisma.documentAutosaveCheckpoint.deleteMany(),
    prisma.documentEditorSession.deleteMany(),
    prisma.documentRetentionRule.deleteMany(),
    prisma.documentExternalMetadata.deleteMany(),
    prisma.documentAuditLog.deleteMany(),
    prisma.documentNotification.deleteMany(),
    prisma.documentShareLink.deleteMany(),
    prisma.documentViewLog.deleteMany(),
    prisma.documentDownloadLog.deleteMany(),
    prisma.documentReadConfirmation.deleteMany(),
    prisma.documentDistribution.deleteMany(),
    prisma.documentAccessGroupUser.deleteMany(),
    prisma.documentAccessGroup.deleteMany(),
    prisma.documentPermission.deleteMany(),
    prisma.documentRelation.deleteMany(),
    prisma.documentCommentMention.deleteMany(),
    prisma.documentComment.deleteMany(),
    prisma.documentReviewRequest.deleteMany(),
    prisma.documentApproval.deleteMany(),
    prisma.documentWorkflowStep.deleteMany(),
    prisma.documentWorkflow.deleteMany(),
    prisma.documentStatusHistory.deleteMany(),
    prisma.documentFile.deleteMany(),
    prisma.documentVersion.deleteMany(),
    prisma.documentTemplate.deleteMany(),
    prisma.documentCodeRule.deleteMany(),
    prisma.documentTypeConfig.deleteMany(),
    prisma.document.deleteMany(),
    prisma.auditAiSuggestion.deleteMany(),
    prisma.auditExternalAccess.deleteMany(),
    prisma.auditNotificationRule.deleteMany(),
    prisma.auditWorkflow.deleteMany(),
    prisma.auditTimelineEvent.deleteMany(),
    prisma.auditFollowUp.deleteMany(),
    prisma.auditApproval.deleteMany(),
    prisma.auditReport.deleteMany(),
    prisma.auditEvidence.deleteMany(),
    prisma.auditChecklistResponse.deleteMany(),
    prisma.auditChecklistExecution.deleteMany(),
    prisma.auditChecklistItem.deleteMany(),
    prisma.auditChecklistSection.deleteMany(),
    prisma.auditChecklistTemplate.deleteMany(),
    prisma.auditFindingClassification.deleteMany(),
    prisma.auditRequirement.deleteMany(),
    prisma.auditStandard.deleteMany(),
    prisma.auditorConflict.deleteMany(),
    prisma.auditorAvailability.deleteMany(),
    prisma.auditorCertification.deleteMany(),
    prisma.auditorCompetency.deleteMany(),
    prisma.auditorProfile.deleteMany(),
    prisma.auditRiskScore.deleteMany(),
    prisma.auditRiskCriterion.deleteMany(),
    prisma.auditUniverseItem.deleteMany(),
    prisma.auditProgramRevision.deleteMany(),
    prisma.auditProgram.deleteMany(),
    prisma.auditFinding.deleteMany(),
    prisma.audit.deleteMany(),
    prisma.formAiSuggestion.deleteMany(),
    prisma.formImportJob.deleteMany(),
    prisma.formExportJob.deleteMany(),
    prisma.formNotificationRule.deleteMany(),
    prisma.formOfflineSyncConflict.deleteMany(),
    prisma.formOfflineSyncQueue.deleteMany(),
    prisma.formKiosk.deleteMany(),
    prisma.formQrCode.deleteMany(),
    prisma.formExternalLink.deleteMany(),
    prisma.formEvidence.deleteMany(),
    prisma.formRecordTimeline.deleteMany(),
    prisma.formRecordCorrection.deleteMany(),
    prisma.formIssue.deleteMany(),
    prisma.formApproval.deleteMany(),
    prisma.formSignature.deleteMany(),
    prisma.formExecutionResponseItem.deleteMany(),
    prisma.formExecutionAssignment.deleteMany(),
    prisma.formOperationalRecord.deleteMany(),
    prisma.formAnswer.deleteMany(),
    prisma.formSubmission.deleteMany(),
    prisma.formExecution.deleteMany(),
    prisma.formSchedule.deleteMany(),
    prisma.formPrintLayout.deleteMany(),
    prisma.formPermission.deleteMany(),
    prisma.formWorkflow.deleteMany(),
    prisma.formTemplateFormula.deleteMany(),
    prisma.formTemplateRule.deleteMany(),
    prisma.formReusableBlock.deleteMany(),
    prisma.formFieldOption.deleteMany(),
    prisma.formField.deleteMany(),
    prisma.formTemplateSection.deleteMany(),
    prisma.formTemplateVersion.deleteMany(),
    prisma.formTemplateTagRelation.deleteMany(),
    prisma.formTemplate.deleteMany(),
    prisma.formRetentionPolicy.deleteMany(),
    prisma.formTag.deleteMany(),
    prisma.formFolder.deleteMany(),
    prisma.formCategory.deleteMany(),
    prisma.formTypeConfig.deleteMany(),
    prisma.actionTask.deleteMany(),
    prisma.actionPlan.deleteMany(),
    prisma.deviationAnalysis.deleteMany(),
    prisma.deviationCause.deleteMany(),
    prisma.deviation.deleteMany(),
    prisma.indicatorResult.deleteMany(),
    prisma.indicatorTarget.deleteMany(),
    prisma.indicatorTreeRelation.deleteMany(),
    prisma.indicator.deleteMany(),
    prisma.objectiveRelation.deleteMany(),
    prisma.keyResult.deleteMany(),
    prisma.oKRCheckin.deleteMany(),
    prisma.oKRObjective.deleteMany(),
    prisma.oKRCycle.deleteMany(),
    prisma.strategicObjective.deleteMany(),
    prisma.perspective.deleteMany(),
    prisma.strategicMap.deleteMany(),
    prisma.meetingParticipant.deleteMany(),
    prisma.meetingAgendaItem.deleteMany(),
    prisma.meetingDecision.deleteMany(),
    prisma.meeting.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.userPermission.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.user.deleteMany(),
    prisma.profilePermission.deleteMany(),
    prisma.accessProfile.deleteMany(),
    prisma.parameterItem.deleteMany(),
    prisma.parameterCategory.deleteMany(),
    prisma.orgNode.deleteMany(),
    prisma.branch.deleteMany(),
    prisma.appSetting.deleteMany(),
    prisma.importError.deleteMany(),
    prisma.importJob.deleteMany(),
    prisma.attachment.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.projectMilestone.deleteMany(),
    prisma.projectTask.deleteMany(),
    prisma.project.deleteMany(),
    prisma.permission.deleteMany(),
    prisma.company.deleteMany(),
  ]);

  // ---------------- Empresa ----------------
  console.log('[seed] criando empresa demo...');
  const company = await prisma.company.create({
    data: {
      name: 'Empresa Demo Industrial',
      tradeName: 'Demo Industrial',
      cnpj: '00.000.000/0001-00',
    },
  });

  // ---------------- Filiais ----------------
  const filiais = [
    { name: 'Unidade Matriz', code: 'MAT', city: 'Sao Paulo', state: 'SP' },
    { name: 'Unidade Agricola', code: 'AGR', city: 'Ribeirao Preto', state: 'SP' },
    { name: 'Unidade Industrial', code: 'IND', city: 'Sumare', state: 'SP' },
  ];
  const branches = await Promise.all(
    filiais.map((b) => prisma.branch.create({ data: { companyId: company.id, ...b } })),
  );
  const matriz = branches[0];

  // ---------------- Arvore organizacional ----------------
  console.log('[seed] criando estrutura organizacional...');
  const rootCompany = await prisma.orgNode.create({
    data: {
      companyId: company.id,
      branchId: matriz.id,
      name: company.name,
      code: 'EMP',
      type: OrgNodeType.COMPANY,
      color: '#6366f1',
      icon: 'Building2',
    },
  });

  const branchNode = await prisma.orgNode.create({
    data: {
      companyId: company.id,
      branchId: matriz.id,
      parentId: rootCompany.id,
      name: matriz.name,
      code: 'MAT',
      type: OrgNodeType.BRANCH,
      color: '#3b82f6',
      icon: 'Factory',
    },
  });

  const directorate = await prisma.orgNode.create({
    data: {
      companyId: company.id,
      branchId: matriz.id,
      parentId: branchNode.id,
      name: 'Diretoria',
      code: 'DIR',
      type: OrgNodeType.DIRECTORATE,
      color: '#8b5cf6',
      icon: 'Crown',
    },
  });

  const areasSpec: Array<{ name: string; code: string; color: string; icon: string }> = [
    { name: 'RH', code: 'RH', color: '#06b6d4', icon: 'Users' },
    { name: 'Seguranca do Trabalho', code: 'SST', color: '#ef4444', icon: 'ShieldAlert' },
    { name: 'Producao', code: 'PROD', color: '#f97316', icon: 'Cog' },
    { name: 'Manutencao', code: 'MAN', color: '#eab308', icon: 'Wrench' },
    { name: 'Qualidade', code: 'QUA', color: '#10b981', icon: 'BadgeCheck' },
    { name: 'Suprimentos', code: 'SUP', color: '#0ea5e9', icon: 'Truck' },
    { name: 'Financeiro', code: 'FIN', color: '#22c55e', icon: 'DollarSign' },
    { name: 'TI', code: 'TI', color: '#a855f7', icon: 'Server' },
    { name: 'Logistica', code: 'LOG', color: '#f59e0b', icon: 'Boxes' },
  ];

  const areaMap = new Map<string, string>();
  for (const a of areasSpec) {
    const node = await prisma.orgNode.create({
      data: {
        companyId: company.id,
        branchId: matriz.id,
        parentId: directorate.id,
        name: a.name,
        code: a.code,
        type: OrgNodeType.AREA,
        color: a.color,
        icon: a.icon,
      },
    });
    areaMap.set(a.name, node.id);
  }
  areaMap.set('Diretoria', directorate.id);

  // ---------------- Usuarios ----------------
  console.log('[seed] criando usuarios...');
  const hash = await bcrypt.hash('123456', 10);
  const demoUser = await prisma.user.create({
    data: {
      companyId: company.id,
      email: 'demo@demo.com',
      passwordHash: hash,
      name: 'Usuario Demonstracao',
      role: UserRoleEnum.MANAGER,
      jobTitle: 'Gestor de Demonstracao',
      defaultNodeId: directorate.id,
    },
  });

  const admin = await prisma.user.create({
    data: {
      companyId: company.id,
      email: 'admin@demo.com',
      passwordHash: hash,
      name: 'Administrador Demo',
      role: UserRoleEnum.SUPER_ADMIN,
      jobTitle: 'Administrador',
      defaultNodeId: directorate.id,
    },
  });

  const director = await prisma.user.create({
    data: {
      companyId: company.id,
      email: 'diretoria@demo.com',
      passwordHash: hash,
      name: 'Marina Diretora',
      role: UserRoleEnum.DIRECTOR,
      jobTitle: 'Diretora Industrial',
      defaultNodeId: directorate.id,
    },
  });

  const managers: Record<string, { id: string; name: string }> = {};
  for (const a of areasSpec) {
    const u = await prisma.user.create({
      data: {
        companyId: company.id,
        email: `gestor.${a.code.toLowerCase()}@demo.com`,
        passwordHash: hash,
        name: `Gestor ${a.name}`,
        role: UserRoleEnum.MANAGER,
        jobTitle: `Gerente de ${a.name}`,
        defaultNodeId: areaMap.get(a.name)!,
      },
    });
    managers[a.name] = { id: u.id, name: u.name };
    await prisma.orgNode.update({
      where: { id: areaMap.get(a.name)! },
      data: { responsibleUserId: u.id },
    });
  }
  await prisma.orgNode.update({ where: { id: directorate.id }, data: { responsibleUserId: director.id } });

  // ---------------- Mapa estrategico ----------------
  console.log('[seed] criando mapa estrategico...');
  const map = await prisma.strategicMap.create({
    data: {
      companyId: company.id,
      name: 'Mapa Estrategico 2026',
      startsAt: new Date('2026-01-01'),
      endsAt: new Date('2026-12-31'),
    },
  });
  const perspectivesSpec: Array<{ kind: PerspectiveKind; name: string; color: string }> = [
    { kind: PerspectiveKind.FINANCIAL, name: 'Financeira', color: '#22c55e' },
    { kind: PerspectiveKind.CUSTOMERS, name: 'Clientes', color: '#3b82f6' },
    { kind: PerspectiveKind.INTERNAL_PROCESS, name: 'Processos Internos', color: '#f97316' },
    { kind: PerspectiveKind.LEARNING_GROWTH, name: 'Aprendizado e Crescimento', color: '#a855f7' },
    { kind: PerspectiveKind.SAFETY, name: 'Seguranca', color: '#ef4444' },
    { kind: PerspectiveKind.ESG, name: 'ESG', color: '#10b981' },
  ];
  const perspByKind = new Map<PerspectiveKind, string>();
  for (let i = 0; i < perspectivesSpec.length; i++) {
    const p = perspectivesSpec[i];
    const persp = await prisma.perspective.create({
      data: { mapId: map.id, kind: p.kind, name: p.name, color: p.color, position: i },
    });
    perspByKind.set(p.kind, persp.id);
  }

  const objectivesSpec = [
    { name: 'Reduzir custo de transformacao', persp: PerspectiveKind.FINANCIAL, status: ObjectiveStatus.AT_RISK },
    { name: 'Aumentar produtividade industrial', persp: PerspectiveKind.INTERNAL_PROCESS, status: ObjectiveStatus.ON_TRACK },
    { name: 'Zerar acidentes com afastamento', persp: PerspectiveKind.SAFETY, status: ObjectiveStatus.OFF_TRACK },
    { name: 'Desenvolver lideranca', persp: PerspectiveKind.LEARNING_GROWTH, status: ObjectiveStatus.ON_TRACK },
    { name: 'Excelencia em qualidade', persp: PerspectiveKind.CUSTOMERS, status: ObjectiveStatus.ON_TRACK },
    { name: 'Reduzir consumo energetico', persp: PerspectiveKind.ESG, status: ObjectiveStatus.AT_RISK },
  ];
  const objectivesByName = new Map<string, string>();
  for (let i = 0; i < objectivesSpec.length; i++) {
    const o = objectivesSpec[i];
    const obj = await prisma.strategicObjective.create({
      data: {
        mapId: map.id,
        perspectiveId: perspByKind.get(o.persp)!,
        name: o.name,
        status: o.status,
        weight: 1 + (i % 3),
        position: i,
      },
    });
    objectivesByName.set(o.name, obj.id);
  }

  // ---------------- Relacoes entre objetivos ----------------
  const relPairs: Array<[string, string]> = [
    ['Desenvolver lideranca', 'Aumentar produtividade industrial'],
    ['Aumentar produtividade industrial', 'Reduzir custo de transformacao'],
    ['Excelencia em qualidade', 'Reduzir custo de transformacao'],
    ['Zerar acidentes com afastamento', 'Aumentar produtividade industrial'],
    ['Reduzir consumo energetico', 'Reduzir custo de transformacao'],
  ];
  for (const [from, to] of relPairs) {
    const fromId = objectivesByName.get(from);
    const toId = objectivesByName.get(to);
    if (!fromId || !toId) continue;
    await prisma.objectiveRelation.create({ data: { fromId, toId, weight: 1 } });
  }

  // ---------------- OKR Cycle ----------------
  console.log('[seed] criando ciclo OKR com check-ins...');
  const okrCycle = await prisma.oKRCycle.create({
    data: {
      companyId: company.id,
      name: 'Q2 2026',
      startsAt: new Date('2026-04-01'),
      endsAt: new Date('2026-06-30'),
    },
  });
  const okrObj1 = await prisma.oKRObjective.create({
    data: {
      cycleId: okrCycle.id,
      strategicObjId: objectivesByName.get('Aumentar produtividade industrial'),
      name: 'Bater 95% de eficiencia industrial no Q2',
      description: 'Elevar performance operacional para melhorar margem.',
      ownerName: 'Diretoria Industrial',
      team: 'Producao',
      weight: 3,
      confidence: 0.6,
      status: ObjectiveStatus.ON_TRACK,
    },
  });
  await prisma.keyResult.createMany({
    data: [
      { objectiveId: okrObj1.id, metric: 'Eficiencia operacional', unit: IndicatorUnit.PERCENT, startValue: 78, currentValue: 84, targetValue: 95, direction: Direction.HIGHER_BETTER },
      { objectiveId: okrObj1.id, metric: 'Horas paradas no mes', unit: IndicatorUnit.HOURS, startValue: 120, currentValue: 95, targetValue: 60, direction: Direction.LOWER_BETTER },
      { objectiveId: okrObj1.id, metric: 'Producao mensal (t)', unit: IndicatorUnit.TONS, startValue: 8000, currentValue: 8600, targetValue: 9500, direction: Direction.HIGHER_BETTER },
    ],
  });

  const okrObj2 = await prisma.oKRObjective.create({
    data: {
      cycleId: okrCycle.id,
      strategicObjId: objectivesByName.get('Zerar acidentes com afastamento'),
      name: 'Cultura de seguranca em todas as plantas',
      ownerName: 'Diretoria SST',
      team: 'Seguranca',
      weight: 2,
      confidence: 0.45,
      status: ObjectiveStatus.AT_RISK,
    },
  });
  await prisma.keyResult.createMany({
    data: [
      { objectiveId: okrObj2.id, metric: 'Acidentes com afastamento', unit: IndicatorUnit.QUANTITY, startValue: 3, currentValue: 2, targetValue: 0, direction: Direction.LOWER_BETTER },
      { objectiveId: okrObj2.id, metric: '% colaboradores treinados em NR-12', unit: IndicatorUnit.PERCENT, startValue: 60, currentValue: 78, targetValue: 100, direction: Direction.HIGHER_BETTER },
    ],
  });

  // Check-ins semanais simulados
  const weeks = ['2026-W15', '2026-W16', '2026-W17', '2026-W18'];
  for (let i = 0; i < weeks.length; i++) {
    await prisma.oKRCheckin.create({
      data: { objectiveId: okrObj1.id, weekRef: weeks[i], confidence: 0.5 + i * 0.05, progress: 0.3 + i * 0.1, note: i === 0 ? 'Comeco firme do trimestre' : null },
    });
    await prisma.oKRCheckin.create({
      data: { objectiveId: okrObj2.id, weekRef: weeks[i], confidence: 0.4 + (i % 2) * 0.05, progress: 0.2 + i * 0.08 },
    });
  }

  // ---------------- Indicadores ----------------
  console.log('[seed] criando indicadores, metas e realizados (12 meses)...');
  const periodRefs = lastNPeriodRefs('MONTHLY', 12);

  for (const spec of indicatorSeeds) {
    const ownerId = areaMap.get(spec.ownerAreaName) ?? directorate.id;
    const responsibleUser = managers[spec.ownerAreaName]?.id ?? admin.id;
    const objectiveLink =
      spec.ownerAreaName === 'Producao'
        ? objectivesByName.get('Aumentar produtividade industrial')
        : spec.ownerAreaName === 'Seguranca do Trabalho'
          ? objectivesByName.get('Zerar acidentes com afastamento')
          : spec.ownerAreaName === 'Qualidade'
            ? objectivesByName.get('Excelencia em qualidade')
            : spec.ownerAreaName === 'RH'
              ? objectivesByName.get('Desenvolver lideranca')
              : undefined;

    const indicator = await prisma.indicator.create({
      data: {
        companyId: company.id,
        ownerNodeId: ownerId,
        responsibleUserId: responsibleUser,
        feederUserId: responsibleUser,
        strategicObjectiveId: objectiveLink ?? null,
        name: spec.name,
        code: spec.code,
        description: spec.description,
        type: spec.type,
        unit: spec.unit,
        unitLabel: spec.unitLabel ?? null,
        periodicity: Periodicity.MONTHLY,
        direction: spec.direction,
        feedKind: FeedKind.MANUAL,
        status: IndicatorStatus.ACTIVE,
        weight: spec.weight ?? 1,
        yellowToleranceP: 10,
      },
    });

    // metas - mesma meta para todos os meses (poderia variar)
    for (const ref of periodRefs) {
      await prisma.indicatorTarget.create({
        data: { indicatorId: indicator.id, periodRef: ref, target: spec.baseTarget },
      });
    }

    // realizados - simula 11 meses preenchidos + ultimo mes pendente em 1 a cada 3
    const fillLastMonth = randInt(0, 2) > 0;
    const refsToFill = fillLastMonth ? periodRefs : periodRefs.slice(0, -1);

    for (let i = 0; i < refsToFill.length; i++) {
      const ref = refsToFill[i];
      const noise = (Math.random() * 2 - 1) * (spec.noisePct / 100);
      // bias acumulado puxa o realizado pra direcao "ruim" com o tempo
      const biasFactor = (spec.badBiasPct ?? 0) / 100;
      const positionBias = (i / refsToFill.length) * biasFactor;
      let value = spec.baseTarget * (1 + noise);
      if (spec.direction === Direction.LOWER_BETTER) value *= 1 + positionBias;
      else if (spec.direction === Direction.HIGHER_BETTER) value *= 1 - positionBias;
      if (spec.unit === IndicatorUnit.QUANTITY) value = Math.max(0, Math.round(value));
      value = Number(value.toFixed(2));

      const status = calcStatus({
        value,
        target: spec.baseTarget,
        direction: spec.direction,
        yellowToleranceP: 10,
      });

      await prisma.indicatorResult.create({
        data: {
          indicatorId: indicator.id,
          periodRef: ref,
          periodDate: periodRefToDate(ref, Periodicity.MONTHLY),
          value,
          status: 'FILLED',
          light: status.light as TrafficLight,
          attainment: status.attainment,
          deviationAbs: status.deviationAbs,
          deviationPct: status.deviationPct,
          createdById: responsibleUser,
        },
      });
    }
  }

  // ---------------- Relacoes arvore de indicadores ----------------
  console.log('[seed] criando relacoes entre indicadores...');
  const byCode = new Map<string, string>();
  const inds = await prisma.indicator.findMany({ where: { companyId: company.id }, select: { id: true, code: true } });
  inds.forEach((i) => byCode.set(i.code ?? '', i.id));
  const rel = async (parent: string, child: string) => {
    const p = byCode.get(parent);
    const c = byCode.get(child);
    if (!p || !c) return;
    await prisma.indicatorTreeRelation.upsert({
      where: { parentId_childId: { parentId: p, childId: c } },
      create: { parentId: p, childId: c, kind: 'POSITIVE', weight: 1 },
      update: {},
    });
  };
  await rel('PROD-001', 'PROD-002');
  await rel('PROD-001', 'PROD-003');
  await rel('PROD-001', 'MAN-001');
  await rel('FIN-001', 'PROD-001');
  await rel('FIN-001', 'PROD-003');
  await rel('GES-001', 'GES-002');
  await rel('RH-001', 'PROD-002');
  await rel('SST-001', 'RH-001');

  // ---------------- Desvios + acoes a partir de indicadores vermelhos ----------------
  console.log('[seed] criando desvios e acoes...');
  const reds = await prisma.indicatorResult.findMany({
    where: { indicator: { companyId: company.id }, light: 'RED' },
    orderBy: { periodDate: 'desc' },
    distinct: ['indicatorId'],
    include: { indicator: true },
    take: 6,
  });
  let devSeq = 0;
  for (const red of reds) {
    devSeq++;
    const dev = await prisma.deviation.create({
      data: {
        companyId: company.id,
        indicatorId: red.indicatorId,
        periodRef: red.periodRef,
        number: devSeq,
        title: `Desvio #${devSeq} - ${red.indicator.name} (${red.periodRef})`,
        severity: devSeq <= 2 ? DeviationSeverity.CRITICAL : DeviationSeverity.MODERATE,
        status: pick([DeviationStatus.OPEN, DeviationStatus.IN_ANALYSIS, DeviationStatus.IN_PROGRESS]),
        method: AnalysisMethod.FCA,
        fact: `Indicador ${red.indicator.name} ficou em ${red.value} ante meta ${red.deviationPct?.toFixed(1) ?? '?'}% de desvio.`,
        rootCause: pick([
          'Falta de procedimento padronizado',
          'Equipe sub-dimensionada',
          'Equipamento obsoleto',
          'Variacao na materia-prima',
        ]),
        impact: 'Risco de nao cumprimento do objetivo estrategico vinculado',
        responsibleUserId: red.indicator.responsibleUserId,
        dueDate: new Date(Date.now() + randInt(7, 30) * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.deviationCause.createMany({
      data: [
        { deviationId: dev.id, category: 'Metodo', description: 'Procedimento operacional desatualizado' },
        { deviationId: dev.id, category: 'Mao de obra', description: 'Falta de treinamento especifico' },
      ],
    });
    await prisma.actionPlan.create({
      data: {
        companyId: company.id,
        ownerNodeId: red.indicator.ownerNodeId,
        responsibleUserId: red.indicator.responsibleUserId,
        createdById: admin.id,
        title: `Plano corretivo para ${red.indicator.name}`,
        description: 'Acao aberta automaticamente a partir do desvio.',
        origin: ActionOrigin.DEVIATION,
        originRefId: dev.id,
        deviationId: dev.id,
        priority: devSeq <= 2 ? ActionPriority.CRITICAL : ActionPriority.HIGH,
        status: ActionStatus.IN_PROGRESS,
        startDate: new Date(),
        dueDate: new Date(Date.now() + randInt(15, 45) * 24 * 60 * 60 * 1000),
        progress: randInt(10, 70),
      },
    });
  }

  // Algumas acoes "manuais"
  console.log('[seed] criando acoes manuais avulsas...');
  const areasArr = Array.from(areaMap.entries());
  for (let i = 0; i < 12; i++) {
    const [areaName, nodeId] = pick(areasArr);
    const status = pick([
      ActionStatus.NOT_STARTED,
      ActionStatus.IN_PROGRESS,
      ActionStatus.WAITING_THIRD,
      ActionStatus.DONE,
    ]);
    const dueOffset = randInt(-20, 40);
    await prisma.actionPlan.create({
      data: {
        companyId: company.id,
        ownerNodeId: nodeId,
        responsibleUserId: managers[areaName]?.id ?? admin.id,
        createdById: admin.id,
        title: pick([
          'Padronizar checklist diario',
          'Auditoria de 5S',
          'Treinamento NR-12',
          'Reduzir setup da linha 3',
          'Plano de comunicacao trimestral',
          'Revisao de fornecedores criticos',
          'Implantar reuniao diaria',
        ]) + ` - ${areaName}`,
        description: 'Acao planejada na revisao mensal.',
        origin: ActionOrigin.MANUAL,
        priority: pick([ActionPriority.LOW, ActionPriority.MEDIUM, ActionPriority.HIGH]),
        status,
        startDate: new Date(Date.now() - randInt(0, 30) * 24 * 60 * 60 * 1000),
        dueDate: new Date(Date.now() + dueOffset * 24 * 60 * 60 * 1000),
        progress: status === ActionStatus.DONE ? 100 : randInt(0, 80),
        estimatedCost: randInt(500, 25000),
      },
    });
  }

  // ---------------- Projeto exemplo ----------------
  console.log('[seed] criando projeto exemplo...');
  const projeto = await prisma.project.create({
    data: {
      companyId: company.id,
      name: 'Implantacao de OEE - Linha 3',
      status: 'IN_PROGRESS',
      startsAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000),
      responsible: 'Producao',
      budget: 280_000,
    },
  });
  await prisma.projectMilestone.createMany({
    data: [
      { projectId: projeto.id, name: 'Diagnostico', dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), done: true },
      { projectId: projeto.id, name: 'Aquisicao sensores', dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) },
      { projectId: projeto.id, name: 'Go-live', dueDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) },
    ],
  });
  const now = Date.now();
  const dDays = (offset: number) => new Date(now + offset * 24 * 60 * 60 * 1000);
  const t1 = await prisma.projectTask.create({
    data: {
      projectId: projeto.id,
      name: 'Levantamento de requisitos',
      startDate: dDays(-60),
      endDate: dDays(-40),
      progress: 100,
      responsible: 'Producao',
      position: 0,
    },
  });
  const t2 = await prisma.projectTask.create({
    data: {
      projectId: projeto.id,
      name: 'Compra de sensores',
      startDate: dDays(-40),
      endDate: dDays(15),
      progress: 60,
      responsible: 'Suprimentos',
      dependencyId: t1.id,
      position: 1,
    },
  });
  await prisma.projectTask.create({
    data: {
      projectId: projeto.id,
      name: 'Instalacao e calibracao',
      startDate: dDays(20),
      endDate: dDays(60),
      progress: 0,
      responsible: 'Manutencao',
      dependencyId: t2.id,
      position: 2,
    },
  });
  await prisma.projectTask.create({
    data: {
      projectId: projeto.id,
      name: 'Treinamento operadores',
      startDate: dDays(60),
      endDate: dDays(80),
      progress: 0,
      responsible: 'RH',
      position: 3,
    },
  });

  // ---------------- Reuniao exemplo ----------------
  const meeting = await prisma.meeting.create({
    data: {
      companyId: company.id,
      title: 'Reuniao Mensal de Indicadores - Maio/26',
      kind: 'INDICATORS',
      startsAt: new Date(),
      notes: 'Discussao dos indicadores em vermelho do mes.',
    },
  });
  await prisma.meetingParticipant.createMany({
    data: [
      { meetingId: meeting.id, userId: director.id, attended: true },
      { meetingId: meeting.id, userId: managers['Producao'].id, attended: true },
      { meetingId: meeting.id, userId: managers['Qualidade'].id, attended: true },
    ],
  });
  await prisma.meetingAgendaItem.createMany({
    data: [
      { meetingId: meeting.id, topic: 'Revisao do Mapa Estrategico', position: 0 },
      { meetingId: meeting.id, topic: 'Indicadores em vermelho', position: 1 },
      { meetingId: meeting.id, topic: 'Status acoes prioritarias', position: 2 },
    ],
  });

  // ---------------- Notificacoes iniciais ----------------
  console.log('[seed] criando notificacoes...');
  const redInds = await prisma.indicator.findMany({
    where: { companyId: company.id, results: { some: { light: 'RED' } } },
    take: 3,
    select: { id: true, name: true, responsibleUserId: true },
  });
  for (const r of redInds) {
    if (!r.responsibleUserId) continue;
    await prisma.notification.create({
      data: {
        companyId: company.id,
        userId: r.responsibleUserId,
        kind: 'INDICATOR_OFF_TARGET',
        title: `Indicador critico: ${r.name}`,
        body: 'Atingimento abaixo da faixa amarela no ultimo periodo.',
        link: `/indicators/${r.id}`,
      },
    });
  }
  await prisma.notification.create({
    data: {
      companyId: company.id,
      userId: admin.id,
      kind: 'MEETING_UPCOMING',
      title: 'Reuniao mensal de indicadores hoje',
      body: 'Reuniao mensal de indicadores - Maio/26 inicia em breve.',
      link: '/meetings',
    },
  });

  // ---------------- Permissoes basicas ----------------
  console.log('[seed] criando permissoes de catalogo...');
  await prisma.permission.createMany({
    skipDuplicates: true,
    data: PERMISSION_CATALOG.map(([key, description, module, action]) => ({
      key,
      module,
      action,
      description,
    })),
  });

  const allPermissions = await prisma.permission.findMany({ select: { id: true, key: true } });
  const permissionByKey = new Map(allPermissions.map((p) => [p.key, p.id]));

  for (const profile of DEFAULT_PROFILES) {
    const created = await prisma.accessProfile.create({
      data: {
        companyId: company.id,
        code: profile.code,
        name: profile.name,
        description: profile.description,
        role: profile.role as UserRoleEnum,
        system: true,
      },
    });
    const entries = profile.permissions
      .map((key) => permissionByKey.get(key))
      .filter((id): id is string => Boolean(id))
      .map((permissionId) => ({ profileId: created.id, permissionId }));
    if (entries.length > 0) {
      await prisma.profilePermission.createMany({ data: entries, skipDuplicates: true });
    }
    if (profile.code === 'SUPER_ADMIN') {
      await prisma.user.update({
        where: { id: admin.id },
        data: { accessProfileId: created.id },
      });
    }
    if (profile.code === 'GESTOR') {
      await prisma.user.update({
        where: { id: demoUser.id },
        data: { accessProfileId: created.id },
      });
    }
  }

  // ---------------- Portal Admin Global ----------------
  console.log('[seed] criando Portal Admin Global...');
  await prisma.platformAdminPermission.createMany({
    skipDuplicates: true,
    data: PLATFORM_PERMISSIONS.map(([key, description, group, action]) => ({
      key,
      description,
      group,
      action,
    })),
  });
  const platformPermissions = await prisma.platformAdminPermission.findMany({ select: { id: true, key: true } });
  const platformPermissionByKey = new Map(platformPermissions.map((permission) => [permission.key, permission.id]));

  for (const role of PLATFORM_ROLES) {
    const createdRole = await prisma.platformAdminRole.create({
      data: {
        code: role.code,
        name: role.name,
        description: role.description,
        system: true,
      },
    });
    const rolePermissions = role.permissions
      .map((key) => platformPermissionByKey.get(key))
      .filter((id): id is string => Boolean(id))
      .map((permissionId) => ({ roleId: createdRole.id, permissionId }));
    if (rolePermissions.length > 0) {
      await prisma.platformAdminRolePermission.createMany({ data: rolePermissions, skipDuplicates: true });
    }
  }

  const ownerRole = await prisma.platformAdminRole.findUniqueOrThrow({ where: { code: 'PLATFORM_OWNER' } });
  const platformOwner = await prisma.platformAdminUser.create({
    data: {
      email: 'platform@demo.com',
      passwordHash: hash,
      name: 'Gestao 360 Platform Owner',
      jobTitle: 'Platform Owner',
      status: 'ACTIVE',
    },
  });
  await prisma.platformAdminUserRole.create({
    data: { userId: platformOwner.id, roleId: ownerRole.id },
  });

  await prisma.platformModuleCatalog.createMany({
    skipDuplicates: true,
    data: PLATFORM_MODULES.map((module) => ({
      code: module.code,
      name: module.name,
      description: module.description,
      category: module.category,
      icon: module.icon,
      route: module.route,
      version: module.version,
      globalStatus: 'ACTIVE',
      availability: JSON.stringify(['ESSENCIAL', 'PROFISSIONAL', 'CORPORATIVO', 'ENTERPRISE']),
      dependencies: JSON.stringify(module.dependencies),
      technicalOwner: module.technicalOwner,
      experimental: module.experimental,
      documentation: module.route ? `docs:${module.route}` : null,
      changelog: JSON.stringify([{ version: module.version, note: 'Catalogo inicial' }]),
    })),
  });

  for (const plan of PLATFORM_PLANS) {
    const createdPlan = await prisma.platformPlan.create({
      data: {
        code: plan.code,
        name: plan.name,
        setupPriceCents: plan.setupPriceCents,
        monthlyPriceCents: plan.monthlyPriceCents,
        defaultUsers: plan.defaultUsers,
        defaultBranches: plan.defaultBranches,
        storageLimitMb: plan.storageLimitMb,
        supportLevel: plan.supportLevel,
        sla: plan.sla,
        trialDays: plan.trialDays,
      },
    });
    if (plan.modules.length > 0) {
      await prisma.platformPlanModule.createMany({
        data: plan.modules.map((moduleCode) => ({ planId: createdPlan.id, moduleCode, included: true })),
        skipDuplicates: true,
      });
    }
  }

  const demoPlan = PLATFORM_PLANS.find((plan) => plan.code === 'PROFISSIONAL')!;
  await prisma.platformCompanyProfile.create({
    data: {
      companyId: company.id,
      internalCode: 'G360-0001',
      lifecycleStatus: 'IMPLEMENTATION',
      planCode: demoPlan.code,
      commercialOwner: 'Comercial Gestao 360',
      implementationOwner: 'Implantacao Gestao 360',
      primaryContactName: admin.name,
      primaryContactEmail: admin.email,
      contractStartAt: new Date('2026-06-01'),
      contractEndsAt: new Date('2027-06-01'),
      storageLimitMb: demoPlan.storageLimitMb,
      maxBranches: demoPlan.defaultBranches,
      maxDocuments: 5000,
      maxForms: 500,
      maxIndicators: 1000,
      maxIntegrations: 10,
      healthScore: 92,
    },
  });
  await prisma.platformContract.create({
    data: {
      companyId: company.id,
      planCode: demoPlan.code,
      status: 'ACTIVE',
      startsAt: new Date('2026-06-01'),
      endsAt: new Date('2027-06-01'),
      renewalAt: new Date('2027-05-01'),
      monthlyValueCents: demoPlan.monthlyPriceCents,
      setupValueCents: demoPlan.setupPriceCents,
      notes: 'Contrato demo criado pelo seed.',
    },
  });
  const demoPlanModules = new Set<string>(demoPlan.modules);
  await prisma.platformCompanyModule.createMany({
    skipDuplicates: true,
    data: PLATFORM_MODULES.map((module) => ({
      companyId: company.id,
      moduleCode: module.code,
      status: demoPlanModules.has(module.code) ? 'HERDADO_DO_PLANO' : 'BLOQUEADO',
      inheritedFromPlan: true,
      manuallyOverridden: false,
      note: demoPlanModules.has(module.code) ? null : 'Modulo fora do plano Profissional.',
      updatedBy: platformOwner.id,
      updatedByEmail: platformOwner.email,
    })),
  });

  await prisma.platformEnvironment.createMany({
    skipDuplicates: true,
    data: [
      { code: 'development', name: 'Desenvolvimento', currentVersion: '0.1.0', owner: 'Engineering' },
      { code: 'staging', name: 'Homologacao', currentVersion: '0.1.0', owner: 'QA' },
      { code: 'production', name: 'Producao', currentVersion: '0.1.0', owner: 'SRE' },
    ],
  });
  await prisma.platformRelease.create({
    data: {
      environmentCode: 'production',
      version: '0.1.0',
      status: 'PUBLISHED',
      publishedAt: new Date(),
      responsible: platformOwner.email,
      changes: 'Seed inicial do Portal Admin Global.',
      testResult: 'PENDING_VALIDATION',
    },
  });
  await prisma.platformBackup.create({
    data: {
      environmentCode: 'production',
      status: 'SUCCESS',
      startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      finishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000 + 90_000),
      sizeBytes: 128_000_000,
      locationMasked: 's3://g360-backups/prod/***/backup.dump',
      createdBy: platformOwner.email,
    },
  });
  await prisma.platformIntegrationConfig.createMany({
    skipDuplicates: true,
    data: [
      { code: 'smtp', name: 'SMTP Transacional', environmentCode: 'production', status: 'ACTIVE', owner: 'SRE', maskedSecret: 'smtp-****-demo' },
      { code: 'gemini', name: 'Servico de IA', environmentCode: 'production', status: 'ACTIVE', owner: 'Engineering', maskedSecret: 'AIza****demo' },
      { code: 'calendar-google', name: 'Google Calendar', companyId: company.id, environmentCode: 'production', status: 'PENDING', owner: 'Implantacao' },
    ],
  });
  await prisma.platformHealthCheck.createMany({
    data: [
      { code: 'api', name: 'API NestJS', category: 'application', status: 'ONLINE', latencyMs: 35, message: 'OK' },
      { code: 'database', name: 'PostgreSQL', category: 'database', status: 'ONLINE', latencyMs: 12, message: 'OK' },
      { code: 'jobs', name: 'Processamentos', category: 'jobs', status: 'UNKNOWN', message: 'Fila ainda nao configurada no seed' },
    ],
  });

  // ---------------- Resumo ----------------
  const totals = {
    companies: await prisma.company.count(),
    users: await prisma.user.count(),
    orgNodes: await prisma.orgNode.count(),
    indicators: await prisma.indicator.count(),
    targets: await prisma.indicatorTarget.count(),
    results: await prisma.indicatorResult.count(),
    deviations: await prisma.deviation.count(),
    actions: await prisma.actionPlan.count(),
  };
  console.log('[seed] OK', totals);
  console.log('[seed] Login: demo@demo.com / 123456');
  console.log('[seed] Login alternativo: admin@demo.com / 123456');
  console.log('[seed] Portal Admin Global: platform@demo.com / admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
