import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditWriterService } from '../../common/audit/audit-writer.service';
import { AuthPayload } from '../auth/auth.types';
import { PersonnelService } from './personnel.service';
import { monthBounds } from './time-clock.logic';
import {
  companyTimeHHMM,
  generateAej,
  generateAfd,
  generateMirror,
  type AejAbsence,
  type AejMarking,
  type LegalEmployer,
} from './legal-files.logic';

const MODULE = 'personnel';
const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Central Fiscal: identificação legal do empregador e geração dos arquivos
 * AFD/AEJ (Portaria 671). Deixa explícito o que ainda depende de providências
 * externas (INPI, certificado ICP-Brasil/.p7s, Atestado Técnico).
 */
@Injectable()
export class LegalFilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriterService,
    private readonly personnel: PersonnelService,
  ) {}

  async getConfig(companyId: string) {
    const [config, company] = await Promise.all([
      this.prisma.personnelLegalConfig.findUnique({ where: { companyId } }),
      this.prisma.company.findUnique({ where: { id: companyId }, select: { name: true, cnpj: true } }),
    ]);
    return {
      employerIdType: config?.employerIdType ?? 1,
      cnoCaepf: config?.cnoCaepf ?? null,
      inpiRegistry: config?.inpiRegistry ?? null,
      softwareVersion: config?.softwareVersion ?? 'gestao360-ponto',
      company: { name: company?.name ?? '', cnpj: company?.cnpj ?? null },
    };
  }

  async setConfig(me: AuthPayload, body: any = {}) {
    const employerIdType = body?.employerIdType === 2 ? 2 : 1;
    const cnoCaepf = text(body?.cnoCaepf);
    const inpiRegistry = text(body?.inpiRegistry);
    const saved = await this.prisma.personnelLegalConfig.upsert({
      where: { companyId: me.companyId },
      create: { companyId: me.companyId, employerIdType, cnoCaepf, inpiRegistry, updatedById: me.sub },
      update: { employerIdType, cnoCaepf, inpiRegistry, updatedById: me.sub },
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'PersonnelLegalConfig',
      entityId: saved.id,
      action: 'UPDATE',
      message: 'Identificação legal do empregador atualizada',
      after: { employerIdType, cnoCaepf, inpiRegistry },
    });
    return saved;
  }

  /** Status de conformidade fiscal (checklist do que falta para o REP-P). */
  async complianceStatus(me: AuthPayload) {
    const config = await this.getConfig(me.companyId);
    const items = [
      { key: 'employer_id', label: 'CNPJ/CPF do empregador', ok: Boolean(config.company.cnpj), external: false },
      { key: 'inpi', label: 'Registro do programa no INPI (REP-P)', ok: Boolean(config.inpiRegistry), external: true },
      { key: 'signature', label: 'Certificado ICP-Brasil para assinatura .p7s', ok: false, external: true },
      { key: 'attestation', label: 'Atestado Técnico e Termo de Responsabilidade', ok: false, external: true },
    ];
    return {
      config,
      items,
      readyForInspection: items.every((item) => item.ok),
      note: 'A geração dos arquivos AFD/AEJ está disponível para conferência interna. Os itens marcados como externos dependem de providências da empresa e de validação jurídica antes do uso em fiscalização.',
    };
  }

  private async employer(companyId: string): Promise<LegalEmployer> {
    const config = await this.getConfig(companyId);
    return {
      idType: config.employerIdType,
      idNumber: config.company.cnpj ?? '',
      cnoCaepf: config.cnoCaepf,
      companyName: config.company.name,
      inpiRegistry: config.inpiRegistry,
    };
  }

  /** CPF por userId (via prontuário do DP). */
  private async cpfByUser(companyId: string): Promise<Map<string, string | null>> {
    const profiles = await this.prisma.personnelEmployeeProfile.findMany({
      where: { companyId, userId: { not: null } },
      select: { userId: true, cpf: true },
    });
    return new Map(profiles.map((profile) => [profile.userId as string, profile.cpf]));
  }

  // ------------------------------ AFD ------------------------------

  async buildAfd(me: AuthPayload, ref: string) {
    if (!PERIOD_RE.test(ref)) throw new BadRequestException('Competência inválida (use YYYY-MM).');
    const { first, last } = monthBounds(ref);
    const [employer, cpfMap, entries] = await Promise.all([
      this.employer(me.companyId),
      this.cpfByUser(me.companyId),
      this.prisma.timeClockEntry.findMany({
        where: { companyId: me.companyId, dayKey: { gte: first, lte: last }, status: 'VALID' },
        orderBy: { nsr: 'asc' },
        select: { nsr: true, userId: true, punchedAt: true, hash: true },
      }),
    ]);
    const result = generateAfd({
      employer,
      from: first,
      to: last,
      punches: entries.map((entry) => ({
        nsr: Number(entry.nsr),
        cpf: cpfMap.get(entry.userId) ?? null,
        punchedAt: entry.punchedAt,
        hash: entry.hash,
      })),
      generatedAt: new Date(),
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'TimeClockEntry',
      action: 'AFD_EXPORT',
      message: `AFD gerado para ${ref} (${result.lines} linhas, ${result.warnings.length} avisos)`,
      after: { ref, lines: result.lines },
    });
    return { fileName: `AFD-${ref}.txt`, ...result };
  }

  // ------------------------------ AEJ ------------------------------

  async buildAej(me: AuthPayload, ref: string) {
    if (!PERIOD_RE.test(ref)) throw new BadRequestException('Competência inválida (use YYYY-MM).');
    const { first, last } = monthBounds(ref);
    const [employer, cpfMap, report] = await Promise.all([
      this.employer(me.companyId),
      this.cpfByUser(me.companyId),
      this.personnel.periodReport(me, ref),
    ]);
    const userIds = (report.rows as Array<{ user: { id: string; name: string } }>).map((row) => row.user.id);
    const nameById = new Map((report.rows as Array<{ user: { id: string; name: string } }>).map((row) => [row.user.id, row.user.name]));

    const markings: AejMarking[] = [];
    const absences: AejAbsence[] = [];
    for (const userId of userIds) {
      const days = await this.personnel.payrollDaysForUser(me.companyId, userId, ref);
      for (const day of days) {
        // Marcações tratadas: pares efetivos viram E/S alternados.
        day.pairs.forEach((pair) => {
          markings.push({ cpf: cpfMap.get(userId) ?? null, punchedAt: pair.start, nsr: 0, direction: 'E' });
          markings.push({ cpf: cpfMap.get(userId) ?? null, punchedAt: pair.end, nsr: 0, direction: 'S' });
        });
        if (day.status === 'VACATION') absences.push({ cpf: cpfMap.get(userId) ?? null, dayKey: day.dayKey, kind: 'FERIAS' });
        else if (day.status === 'LEAVE') absences.push({ cpf: cpfMap.get(userId) ?? null, dayKey: day.dayKey, kind: 'AFASTAMENTO' });
        else if (day.status === 'JUSTIFIED') absences.push({ cpf: cpfMap.get(userId) ?? null, dayKey: day.dayKey, kind: 'ABONO' });
        else if (day.status === 'ABSENT') absences.push({ cpf: cpfMap.get(userId) ?? null, dayKey: day.dayKey, kind: 'FALTA' });
      }
    }
    const result = generateAej({
      employer,
      periodRef: ref,
      from: first,
      to: last,
      employees: userIds.map((id) => ({ cpf: cpfMap.get(id) ?? null, name: nameById.get(id) ?? '' })),
      markings,
      absences,
      generatedAt: new Date(),
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'TimeClockEntry',
      action: 'AEJ_EXPORT',
      message: `AEJ gerado para ${ref} (${result.lines} linhas, ${result.warnings.length} avisos)`,
      after: { ref, lines: result.lines },
    });
    return { fileName: `AEJ-${ref}.txt`, ...result };
  }

  // ------------------------ Espelho de Ponto Eletrônico ------------------------

  async buildMirror(me: AuthPayload, ref: string, userId: string) {
    if (!PERIOD_RE.test(ref)) throw new BadRequestException('Competência inválida (use YYYY-MM).');
    const [config, days, user, profile] = await Promise.all([
      this.getConfig(me.companyId),
      this.personnel.mirrorDaysForUser(me, userId, ref),
      this.prisma.user.findFirst({
        where: { id: userId, companyId: me.companyId },
        select: { name: true, jobTitle: true },
      }),
      this.prisma.personnelEmployeeProfile.findFirst({
        where: { companyId: me.companyId, userId },
        select: { cpf: true, pisPasep: true, admissionDate: true },
      }),
    ]);
    if (!user) throw new NotFoundException('Colaborador não encontrado.');
    const result = generateMirror({
      employer: {
        idType: config.employerIdType,
        idNumber: config.company.cnpj ?? '',
        cnoCaepf: config.cnoCaepf,
        companyName: config.company.name,
        inpiRegistry: config.inpiRegistry,
      },
      employee: {
        name: user.name,
        cpf: profile?.cpf ?? null,
        pisPasep: profile?.pisPasep ?? null,
        admissionDate: profile?.admissionDate ? profile.admissionDate.toISOString().slice(0, 10) : null,
        jobTitle: user.jobTitle,
      },
      periodRef: ref,
      days: days.map((day) => ({
        dayKey: day.dayKey,
        holiday: day.holiday,
        status: day.status,
        plannedMinutes: day.plannedMinutes,
        workedMinutes: day.workedMinutes,
        balanceMinutes: day.balanceMinutes,
        marks: day.entries.map((entry) => ({
          time: companyTimeHHMM(entry.punchedAt),
          source: entry.source,
          nsr: entry.nsr,
        })),
      })),
      generatedAt: new Date(),
      softwareVersion: config.softwareVersion,
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'TimeClockEntry',
      action: 'MIRROR_EXPORT',
      message: `Espelho oficial gerado para ${user.name} em ${ref} (${result.warnings.length} avisos)`,
      after: { ref, userId },
    });
    return { fileName: `ESPELHO-${ref}.txt`, ...result };
  }
}

function text(value: unknown): string | null {
  const t = String(value ?? '').trim();
  return t || null;
}
