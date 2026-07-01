import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { UpsertDataIncidentDto, UpsertProcessingRecordDto, UpsertSubprocessorDto } from './lgpd.dto';

/**
 * Módulo de privacidade/LGPD: registro das operações de tratamento (RoPA),
 * suboperadores e incidentes de dados pessoais. Todo acesso é isolado por
 * empresa (multitenancy manual: filtra sempre por companyId e soft-delete).
 */
@Injectable()
export class LgpdService {
  constructor(private readonly prisma: PrismaService) {}

  private toDate(value?: string | null): Date | undefined {
    return value ? new Date(value) : undefined;
  }

  // ----- Visão geral -----
  async overview(me: AuthPayload) {
    const companyId = me.companyId;
    const base = { companyId, deletedAt: null };
    const [records, subprocessors, intlSubprocessors, openIncidents] = await Promise.all([
      this.prisma.dataProcessingRecord.count({ where: base }),
      this.prisma.subprocessor.count({ where: base }),
      this.prisma.subprocessor.count({ where: { ...base, internationalTransfer: true } }),
      this.prisma.dataIncident.count({ where: { ...base, status: { notIn: ['RESOLVED', 'CLOSED'] } } }),
    ]);
    return { records, subprocessors, intlSubprocessors, openIncidents };
  }

  // ----- RoPA -----
  listProcessingRecords(me: AuthPayload) {
    return this.prisma.dataProcessingRecord.findMany({
      where: { companyId: me.companyId, deletedAt: null },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    });
  }

  createProcessingRecord(me: AuthPayload, dto: UpsertProcessingRecordDto) {
    return this.prisma.dataProcessingRecord.create({
      data: {
        companyId: me.companyId,
        createdById: me.sub,
        name: dto.name,
        area: dto.area ?? null,
        purpose: dto.purpose,
        legalBasis: dto.legalBasis,
        dataSubjects: dto.dataSubjects ?? [],
        dataCategories: dto.dataCategories ?? [],
        hasSensitiveData: dto.hasSensitiveData ?? false,
        sharedWith: dto.sharedWith ?? [],
        retentionPeriod: dto.retentionPeriod ?? null,
        securityMeasures: dto.securityMeasures ?? null,
        internationalTransfer: dto.internationalTransfer ?? false,
        status: dto.status ?? 'ACTIVE',
      },
    });
  }

  async updateProcessingRecord(me: AuthPayload, id: string, dto: UpsertProcessingRecordDto) {
    await this.assertOwned('dataProcessingRecord', me.companyId, id);
    return this.prisma.dataProcessingRecord.update({
      where: { id },
      data: {
        name: dto.name,
        area: dto.area ?? null,
        purpose: dto.purpose,
        legalBasis: dto.legalBasis,
        dataSubjects: dto.dataSubjects ?? [],
        dataCategories: dto.dataCategories ?? [],
        hasSensitiveData: dto.hasSensitiveData ?? false,
        sharedWith: dto.sharedWith ?? [],
        retentionPeriod: dto.retentionPeriod ?? null,
        securityMeasures: dto.securityMeasures ?? null,
        internationalTransfer: dto.internationalTransfer ?? false,
        ...(dto.status ? { status: dto.status } : {}),
      },
    });
  }

  async removeProcessingRecord(me: AuthPayload, id: string) {
    await this.assertOwned('dataProcessingRecord', me.companyId, id);
    await this.prisma.dataProcessingRecord.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  }

  // ----- Suboperadores -----
  listSubprocessors(me: AuthPayload) {
    return this.prisma.subprocessor.findMany({
      where: { companyId: me.companyId, deletedAt: null },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    });
  }

  createSubprocessor(me: AuthPayload, dto: UpsertSubprocessorDto) {
    return this.prisma.subprocessor.create({
      data: {
        companyId: me.companyId,
        createdById: me.sub,
        name: dto.name,
        service: dto.service,
        country: dto.country ?? null,
        internationalTransfer: dto.internationalTransfer ?? false,
        transferSafeguard: dto.transferSafeguard ?? null,
        contractRef: dto.contractRef ?? null,
        status: dto.status ?? 'ACTIVE',
        notes: dto.notes ?? null,
      },
    });
  }

  async updateSubprocessor(me: AuthPayload, id: string, dto: UpsertSubprocessorDto) {
    await this.assertOwned('subprocessor', me.companyId, id);
    return this.prisma.subprocessor.update({
      where: { id },
      data: {
        name: dto.name,
        service: dto.service,
        country: dto.country ?? null,
        internationalTransfer: dto.internationalTransfer ?? false,
        transferSafeguard: dto.transferSafeguard ?? null,
        contractRef: dto.contractRef ?? null,
        ...(dto.status ? { status: dto.status } : {}),
        notes: dto.notes ?? null,
      },
    });
  }

  async removeSubprocessor(me: AuthPayload, id: string) {
    await this.assertOwned('subprocessor', me.companyId, id);
    await this.prisma.subprocessor.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  }

  // ----- Incidentes de dados -----
  listIncidents(me: AuthPayload) {
    return this.prisma.dataIncident.findMany({
      where: { companyId: me.companyId, deletedAt: null },
      orderBy: [{ detectedAt: 'desc' }],
    });
  }

  createIncident(me: AuthPayload, dto: UpsertDataIncidentDto) {
    return this.prisma.dataIncident.create({
      data: {
        companyId: me.companyId,
        createdById: me.sub,
        title: dto.title,
        description: dto.description ?? null,
        severity: dto.severity ?? 'MEDIUM',
        status: dto.status ?? 'OPEN',
        affectedData: dto.affectedData ?? [],
        affectedSubjects: dto.affectedSubjects ?? null,
        detectedAt: this.toDate(dto.detectedAt) ?? new Date(),
        containedAt: this.toDate(dto.containedAt) ?? null,
        resolvedAt: this.toDate(dto.resolvedAt) ?? null,
        anpdNotified: dto.anpdNotified ?? false,
        anpdNotifiedAt: this.toDate(dto.anpdNotifiedAt) ?? null,
        subjectsNotified: dto.subjectsNotified ?? false,
        subjectsNotifiedAt: this.toDate(dto.subjectsNotifiedAt) ?? null,
        measures: dto.measures ?? null,
        responsibleUserId: dto.responsibleUserId ?? null,
      },
    });
  }

  async updateIncident(me: AuthPayload, id: string, dto: UpsertDataIncidentDto) {
    await this.assertOwned('dataIncident', me.companyId, id);
    return this.prisma.dataIncident.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description ?? null,
        ...(dto.severity ? { severity: dto.severity } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        affectedData: dto.affectedData ?? [],
        affectedSubjects: dto.affectedSubjects ?? null,
        ...(dto.detectedAt ? { detectedAt: new Date(dto.detectedAt) } : {}),
        containedAt: this.toDate(dto.containedAt) ?? null,
        resolvedAt: this.toDate(dto.resolvedAt) ?? null,
        anpdNotified: dto.anpdNotified ?? false,
        anpdNotifiedAt: this.toDate(dto.anpdNotifiedAt) ?? null,
        subjectsNotified: dto.subjectsNotified ?? false,
        subjectsNotifiedAt: this.toDate(dto.subjectsNotifiedAt) ?? null,
        measures: dto.measures ?? null,
        responsibleUserId: dto.responsibleUserId ?? null,
      },
    });
  }

  async removeIncident(me: AuthPayload, id: string) {
    await this.assertOwned('dataIncident', me.companyId, id);
    await this.prisma.dataIncident.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  }

  /** Garante que o registro pertence à empresa do usuário antes de mutar. */
  private async assertOwned(
    model: 'dataProcessingRecord' | 'subprocessor' | 'dataIncident',
    companyId: string,
    id: string,
  ) {
    // @ts-expect-error índice dinâmico sobre delegates do Prisma (todos expõem findFirst).
    const found = await this.prisma[model].findFirst({ where: { id, companyId, deletedAt: null }, select: { id: true } });
    if (!found) throw new NotFoundException('Registro não encontrado.');
  }
}
