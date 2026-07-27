import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { AccessService } from '../access/access.service';
import { TrainingMatrixService } from './training-matrix.service';
import { ASSIGNMENT_STATUS_LABEL, MODALITY_LABEL } from './training.labels';

const MODULE_KEY = 'training';

export type ReportKind =
  | 'matriz'
  | 'por-colaborador'
  | 'por-cargo'
  | 'por-area'
  | 'por-documento'
  | 'vencidos'
  | 'proximos-vencimento'
  | 'carga-horaria'
  | 'presenca'
  | 'certificados'
  | 'conformidade-area'
  | 'conformidade-cargo'
  | 'autorizados'
  | 'revisao-desatualizada';

const REPORTS: Array<{ kind: ReportKind; label: string; description: string }> = [
  { kind: 'matriz', label: 'Matriz de treinamento', description: 'Todas as exigências por colaborador, com origem e situação' },
  { kind: 'por-colaborador', label: 'Treinamentos por colaborador', description: 'Consolidado individual com conformidade e carga horária' },
  { kind: 'por-cargo', label: 'Treinamentos por cargo', description: 'Exigências e situação agrupadas por cargo' },
  { kind: 'por-area', label: 'Treinamentos por área', description: 'Exigências e situação agrupadas por área' },
  { kind: 'por-documento', label: 'Treinamentos por documento', description: 'Vínculo com o documento controlado e revisão treinada' },
  { kind: 'vencidos', label: 'Treinamentos vencidos', description: 'Exigem reciclagem imediata' },
  { kind: 'proximos-vencimento', label: 'Próximos do vencimento', description: 'Dentro da antecedência configurada' },
  { kind: 'carga-horaria', label: 'Carga horária', description: 'Horas de treinamento concluídas por colaborador' },
  { kind: 'presenca', label: 'Presença e aproveitamento', description: 'Participação, nota e resultado por turma' },
  { kind: 'certificados', label: 'Certificados', description: 'Emitidos, validados e aguardando validação' },
  { kind: 'conformidade-area', label: 'Conformidade por área', description: 'Percentual de exigências resolvidas por área' },
  { kind: 'conformidade-cargo', label: 'Conformidade por cargo', description: 'Percentual de exigências resolvidas por cargo' },
  { kind: 'autorizados', label: 'Colaboradores autorizados por atividade', description: 'Aptos e impedidos para cada treinamento que bloqueia operação' },
  { kind: 'revisao-desatualizada', label: 'Não treinados na revisão atual', description: 'Quem foi treinado numa revisão anterior do documento' },
];

/**
 * Relatórios do módulo. Todos respeitam o filtro de área do usuário e saem em
 * CSV (abre no Excel) a partir dos mesmos dados das telas — nenhum número é
 * recalculado por caminho paralelo.
 */
@Injectable()
export class TrainingReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  catalog() {
    return REPORTS;
  }

  private async areaFilter(me: AuthPayload): Promise<string[] | null> {
    try {
      return await this.access.listAreaFilter(me.sub, MODULE_KEY, 'view');
    } catch {
      return null;
    }
  }

  async build(me: AuthPayload, kind: ReportKind): Promise<{ fileName: string; rows: Array<Record<string, unknown>> }> {
    const known = REPORTS.find((report) => report.kind === kind);
    if (!known) throw new BadRequestException('Relatório desconhecido.');
    const areas = await this.areaFilter(me);
    const employeeScope: Prisma.OrgEmployeeWhereInput = {
      status: 'ACTIVE',
      ...(areas ? { orgNodeId: { in: areas } } : {}),
    };

    const rows = await this.rowsFor(me, kind, employeeScope, areas);
    return { fileName: `treinamento-${kind}.csv`, rows };
  }

  private async rowsFor(
    me: AuthPayload,
    kind: ReportKind,
    employeeScope: Prisma.OrgEmployeeWhereInput,
    areas: string[] | null,
  ): Promise<Array<Record<string, unknown>>> {
    const base: Prisma.TrainingAssignmentWhereInput = {
      companyId: me.companyId,
      deletedAt: null,
      employee: employeeScope,
    };

    if (kind === 'presenca') {
      const rows = await this.prisma.trainingClassParticipant.findMany({
        where: { companyId: me.companyId, employee: employeeScope },
        include: {
          employee: { select: { name: true, registrationId: true, job: { select: { name: true } }, orgNode: { select: { name: true } } } },
          class: { include: { training: { select: { code: true, name: true } }, instructor: { select: { name: true } } } },
        },
        take: 10000,
      });
      return rows.map((row) => ({
        Colaborador: row.employee.name,
        Matrícula: row.employee.registrationId ?? '',
        Cargo: row.employee.job?.name ?? '',
        Área: row.employee.orgNode?.name ?? '',
        Treinamento: `${row.class.training.code} — ${row.class.training.name}`,
        Turma: row.class.startsAt.toLocaleDateString('pt-BR'),
        Instrutor: row.class.instructor?.name ?? '',
        Presença: row.attendance,
        Nota: row.score ? Number(row.score) : '',
        Resultado: row.result,
      }));
    }

    if (kind === 'certificados') {
      const rows = await this.prisma.trainingCertificate.findMany({
        where: { companyId: me.companyId, deletedAt: null, employee: employeeScope },
        include: {
          employee: { select: { name: true, registrationId: true, orgNode: { select: { name: true } } } },
          training: { select: { code: true, name: true } },
        },
        take: 10000,
      });
      return rows.map((row) => ({
        Colaborador: row.employee.name,
        Matrícula: row.employee.registrationId ?? '',
        Área: row.employee.orgNode?.name ?? '',
        Treinamento: row.training ? `${row.training.code} — ${row.training.name}` : '',
        Origem: row.origin === 'EXTERNAL' ? 'Externo' : 'Interno',
        Situação: row.status,
        Número: row.number ?? '',
        Instituição: row.institution ?? '',
        Emissão: row.issuedAt?.toLocaleDateString('pt-BR') ?? '',
        Validade: row.validUntil?.toLocaleDateString('pt-BR') ?? '',
      }));
    }

    // Os demais relatórios derivam da matriz, mudando filtro e agrupamento.
    const where: Prisma.TrainingAssignmentWhereInput = { ...base };
    if (kind === 'vencidos') where.status = 'EXPIRED';
    if (kind === 'proximos-vencimento') where.status = 'DUE_SOON';
    if (kind === 'carga-horaria') where.completedAt = { not: null };
    if (kind === 'por-documento' || kind === 'revisao-desatualizada') {
      where.training = { documentId: { not: null }, deletedAt: null };
    }

    const assignments = await this.prisma.trainingAssignment.findMany({
      where,
      include: {
        employee: {
          select: { id: true, name: true, registrationId: true, job: { select: { id: true, name: true } }, orgNode: { select: { id: true, name: true } } },
        },
        training: {
          select: {
            id: true, code: true, name: true, modality: true, workloadMinutes: true, documentVersion: true,
            document: { select: { code: true, title: true, version: true } },
          },
        },
        requirement: { select: { justification: true, activity: true, blocksOperation: true } },
      },
      take: 20000,
    });

    if (kind === 'revisao-desatualizada') {
      return assignments
        .filter(
          (row) =>
            row.training.document &&
            (row.trainedDocumentVersion === null || row.trainedDocumentVersion < row.training.document.version),
        )
        .map((row) => ({
          Colaborador: row.employee.name,
          Matrícula: row.employee.registrationId ?? '',
          Cargo: row.employee.job?.name ?? '',
          Área: row.employee.orgNode?.name ?? '',
          Documento: `${row.training.document!.code ?? ''} ${row.training.document!.title}`.trim(),
          'Revisão atual': row.training.document!.version,
          'Revisão treinada': row.trainedDocumentVersion ?? 'Nunca treinado',
          Situação: ASSIGNMENT_STATUS_LABEL[row.status] ?? row.status,
        }));
    }

    if (kind === 'carga-horaria') {
      const byEmployee = new Map<string, { name: string; registration: string; area: string; minutes: number; count: number }>();
      for (const row of assignments) {
        const current = byEmployee.get(row.employeeId) ?? {
          name: row.employee.name,
          registration: row.employee.registrationId ?? '',
          area: row.employee.orgNode?.name ?? '',
          minutes: 0,
          count: 0,
        };
        current.minutes += row.training.workloadMinutes;
        current.count += 1;
        byEmployee.set(row.employeeId, current);
      }
      return Array.from(byEmployee.values()).map((row) => ({
        Colaborador: row.name,
        Matrícula: row.registration,
        Área: row.area,
        'Treinamentos concluídos': row.count,
        'Horas acumuladas': Math.round((row.minutes / 60) * 10) / 10,
      }));
    }

    if (kind === 'conformidade-area' || kind === 'conformidade-cargo') {
      const byKey = new Map<string, { label: string; total: number; settled: number }>();
      for (const row of assignments) {
        const key =
          kind === 'conformidade-area'
            ? row.employee.orgNode?.id ?? 'sem-area'
            : row.employee.job?.id ?? 'sem-cargo';
        const label =
          kind === 'conformidade-area' ? row.employee.orgNode?.name ?? 'Sem área' : row.employee.job?.name ?? 'Sem cargo';
        const current = byKey.get(key) ?? { label, total: 0, settled: 0 };
        current.total += 1;
        if (TrainingMatrixService.SETTLED.includes(row.status)) current.settled += 1;
        byKey.set(key, current);
      }
      return Array.from(byKey.values()).map((row) => ({
        [kind === 'conformidade-area' ? 'Área' : 'Cargo']: row.label,
        'Exigências': row.total,
        Resolvidas: row.settled,
        Pendentes: row.total - row.settled,
        Conformidade: `${Math.round((row.settled / (row.total || 1)) * 100)}%`,
      }));
    }

    if (kind === 'autorizados') {
      return assignments
        .filter((row) => row.requirement?.blocksOperation)
        .map((row) => ({
          Colaborador: row.employee.name,
          Matrícula: row.employee.registrationId ?? '',
          Cargo: row.employee.job?.name ?? '',
          Área: row.employee.orgNode?.name ?? '',
          Atividade: row.requirement?.activity ?? '',
          Treinamento: `${row.training.code} — ${row.training.name}`,
          Situação: TrainingMatrixService.SETTLED.includes(row.status) ? 'AUTORIZADO' : 'IMPEDIDO',
          Detalhe: ASSIGNMENT_STATUS_LABEL[row.status] ?? row.status,
          'Válido até': row.validUntil?.toLocaleDateString('pt-BR') ?? '',
        }));
    }

    // matriz, por-colaborador, por-cargo, por-area, por-documento, vencidos,
    // proximos-vencimento compartilham o mesmo detalhamento.
    return assignments.map((row) => ({
      Colaborador: row.employee.name,
      Matrícula: row.employee.registrationId ?? '',
      Cargo: row.employee.job?.name ?? '',
      Área: row.employee.orgNode?.name ?? '',
      Código: row.training.code,
      Treinamento: row.training.name,
      Modalidade: MODALITY_LABEL[row.training.modality] ?? row.training.modality,
      'Carga (h)': Math.round((row.training.workloadMinutes / 60) * 10) / 10,
      Obrigatório: row.mandatory ? 'Sim' : 'Não',
      Situação: ASSIGNMENT_STATUS_LABEL[row.status] ?? row.status,
      Prazo: row.dueAt?.toLocaleDateString('pt-BR') ?? '',
      Realizado: row.completedAt?.toLocaleDateString('pt-BR') ?? '',
      'Válido até': row.validUntil?.toLocaleDateString('pt-BR') ?? '',
      Nota: row.score ? Number(row.score) : '',
      Documento: row.training.document ? `${row.training.document.code ?? ''} ${row.training.document.title}`.trim() : '',
      'Revisão treinada': row.trainedDocumentVersion ?? '',
      'Origem da exigência': row.requirement?.justification ?? row.requirement?.activity ?? '',
    }));
  }

  /** CSV com BOM e ponto e vírgula — abre direto no Excel em pt-BR. */
  toCsv(rows: Array<Record<string, unknown>>): string {
    if (rows.length === 0) return '﻿Nenhum registro encontrado para os filtros selecionados.';
    const headers = Object.keys(rows[0]!);
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const lines = rows.map((row) => headers.map((header) => escape(row[header])).join(';'));
    return ['﻿' + headers.join(';'), ...lines].join('\r\n');
  }
}
