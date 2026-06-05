import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';

type Tx = Prisma.TransactionClient;

const DEFAULT_TYPES: Array<{
  name: string;
  sigla: string;
  prefix: string;
  category: DocumentType;
  defaultValidityDays: number;
}> = [
  { name: 'Politica', sigla: 'POL', prefix: 'POL', category: DocumentType.POLICY, defaultValidityDays: 730 },
  { name: 'Procedimento', sigla: 'PRO', prefix: 'PRO', category: DocumentType.PROCEDURE, defaultValidityDays: 365 },
  { name: 'Instrucao de Trabalho', sigla: 'IT', prefix: 'IT', category: DocumentType.INSTRUCTION, defaultValidityDays: 365 },
  { name: 'Registro', sigla: 'REG', prefix: 'REG', category: DocumentType.RECORD, defaultValidityDays: 1825 },
  { name: 'Formulario', sigla: 'FOR', prefix: 'FOR', category: DocumentType.FORM, defaultValidityDays: 365 },
  { name: 'Manual', sigla: 'MAN', prefix: 'MAN', category: DocumentType.MANUAL, defaultValidityDays: 730 },
  { name: 'Documento Externo', sigla: 'EXT', prefix: 'EXT', category: DocumentType.EXTERNAL, defaultValidityDays: 365 },
];

@Injectable()
export class DocumentCodeService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDefaultTypes(companyId: string, userId?: string) {
    const existing = await this.prisma.documentTypeConfig.count({ where: { companyId, deletedAt: null } });
    if (existing > 0) return;
    await this.prisma.$transaction(
      DEFAULT_TYPES.map((item) =>
        this.prisma.documentTypeConfig.create({
          data: {
            companyId,
            name: item.name,
            sigla: item.sigla,
            prefix: item.prefix,
            category: item.category,
            defaultValidityDays: item.defaultValidityDays,
            alertDays: 30,
            codePattern: '{{PREFIX}}-{{SEQ}}',
            digits: 3,
            createdById: userId ?? null,
          },
        }),
      ),
    );
  }

  async listTypes(me: AuthPayload) {
    await this.ensureDefaultTypes(me.companyId, me.sub);
    return this.prisma.documentTypeConfig.findMany({
      where: { companyId: me.companyId, deletedAt: null },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
  }

  async createType(me: AuthPayload, body: any) {
    const name = requiredText(body?.name, 'Nome');
    const sigla = requiredText(body?.sigla, 'Sigla').toUpperCase();
    const prefix = requiredText(body?.prefix ?? sigla, 'Prefixo').toUpperCase();
    const category = parseType(body?.category) ?? DocumentType.PROCEDURE;
    try {
      return await this.prisma.documentTypeConfig.create({
        data: {
          companyId: me.companyId,
          name,
          sigla,
          prefix,
          description: nullableText(body?.description),
          category,
          codePattern: nullableText(body?.codePattern) ?? '{{PREFIX}}-{{SEQ}}',
          sequenceScope: nullableText(body?.sequenceScope) ?? 'TYPE',
          digits: positiveInt(body?.digits, 3),
          nextNumber: positiveInt(body?.nextNumber, 1),
          defaultValidityDays: optionalPositiveInt(body?.defaultValidityDays),
          alertDays: positiveInt(body?.alertDays, 30),
          requiresPeriodicReview: body?.requiresPeriodicReview ?? true,
          editable: body?.editable ?? true,
          allowManualCode: body?.allowManualCode ?? false,
          createOnlyByRequest: body?.createOnlyByRequest ?? false,
          active: body?.active ?? true,
          customFields: body?.customFields ?? undefined,
          approvalFlow: body?.approvalFlow ?? undefined,
          createdById: me.sub,
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') throw new ConflictException('Ja existe tipo de documento com esta sigla nesta empresa.');
      throw error;
    }
  }

  async updateType(me: AuthPayload, id: string, patch: any) {
    const before = await this.prisma.documentTypeConfig.findFirst({ where: { id, companyId: me.companyId, deletedAt: null } });
    if (!before) throw new NotFoundException('Tipo de documento nao encontrado.');
    const data: Prisma.DocumentTypeConfigUpdateInput = {};
    if ('name' in (patch ?? {})) data.name = requiredText(patch.name, 'Nome');
    if ('sigla' in (patch ?? {})) data.sigla = requiredText(patch.sigla, 'Sigla').toUpperCase();
    if ('prefix' in (patch ?? {})) data.prefix = requiredText(patch.prefix, 'Prefixo').toUpperCase();
    if ('description' in (patch ?? {})) data.description = nullableText(patch.description);
    if ('category' in (patch ?? {})) data.category = parseType(patch.category) ?? before.category;
    if ('codePattern' in (patch ?? {})) data.codePattern = nullableText(patch.codePattern) ?? before.codePattern;
    if ('sequenceScope' in (patch ?? {})) data.sequenceScope = nullableText(patch.sequenceScope) ?? before.sequenceScope;
    if ('digits' in (patch ?? {})) data.digits = positiveInt(patch.digits, before.digits);
    if ('nextNumber' in (patch ?? {})) data.nextNumber = positiveInt(patch.nextNumber, before.nextNumber);
    if ('defaultValidityDays' in (patch ?? {})) data.defaultValidityDays = optionalPositiveInt(patch.defaultValidityDays);
    if ('alertDays' in (patch ?? {})) data.alertDays = positiveInt(patch.alertDays, before.alertDays);
    if ('requiresPeriodicReview' in (patch ?? {})) data.requiresPeriodicReview = Boolean(patch.requiresPeriodicReview);
    if ('editable' in (patch ?? {})) data.editable = Boolean(patch.editable);
    if ('allowManualCode' in (patch ?? {})) data.allowManualCode = Boolean(patch.allowManualCode);
    if ('createOnlyByRequest' in (patch ?? {})) data.createOnlyByRequest = Boolean(patch.createOnlyByRequest);
    if ('active' in (patch ?? {})) data.active = Boolean(patch.active);
    if ('customFields' in (patch ?? {})) data.customFields = patch.customFields ?? Prisma.DbNull;
    if ('approvalFlow' in (patch ?? {})) data.approvalFlow = patch.approvalFlow ?? Prisma.DbNull;
    data.updatedById = me.sub;
    try {
      return await this.prisma.documentTypeConfig.update({ where: { id }, data });
    } catch (error: any) {
      if (error?.code === 'P2002') throw new ConflictException('Ja existe tipo de documento com esta sigla nesta empresa.');
      throw error;
    }
  }

  async resolveType(companyId: string, typeConfigId: string | null | undefined, type: DocumentType, tx: Tx = this.prisma) {
    if (typeConfigId) {
      const config = await tx.documentTypeConfig.findFirst({ where: { id: typeConfigId, companyId, deletedAt: null, active: true } });
      if (!config) throw new NotFoundException('Tipo de documento configurado nao encontrado.');
      return config;
    }
    let config = await tx.documentTypeConfig.findFirst({
      where: { companyId, category: type, deletedAt: null, active: true },
      orderBy: { createdAt: 'asc' },
    });
    if (config) return config;

    const fallback = DEFAULT_TYPES.find((item) => item.category === type) ?? DEFAULT_TYPES.find((item) => item.category === DocumentType.PROCEDURE)!;
    config = await tx.documentTypeConfig.create({
      data: {
        companyId,
        name: fallback.name,
        sigla: fallback.sigla,
        prefix: fallback.prefix,
        category: fallback.category,
        defaultValidityDays: fallback.defaultValidityDays,
      },
    });
    return config;
  }

  async nextCode(tx: Tx, companyId: string, typeConfigId: string | null | undefined, type: DocumentType) {
    const config = await this.resolveType(companyId, typeConfigId, type, tx);
    const year = new Date().getFullYear();
    const startsAt = config.resetYearly && config.currentYear !== year ? 1 : config.nextNumber;
    for (let offset = 0; offset < 200; offset++) {
      const next = startsAt + offset;
      const code = formatCode(config.codePattern, config.prefix, config.digits, next, year);
      const duplicate = await tx.document.findFirst({ where: { companyId, code, deletedAt: null }, select: { id: true } });
      if (!duplicate) {
        await tx.documentTypeConfig.update({
          where: { id: config.id },
          data: { nextNumber: next + 1, currentYear: config.resetYearly ? year : config.currentYear },
        });
        return { code, typeConfig: config };
      }
    }
    throw new ConflictException('Nao foi possivel gerar um codigo unico para este tipo de documento.');
  }
}

function formatCode(pattern: string, prefix: string, digits: number, next: number, year: number) {
  const seq = String(next).padStart(Math.max(1, digits), '0');
  return (pattern || '{{PREFIX}}-{{SEQ}}')
    .replaceAll('{{PREFIX}}', prefix)
    .replaceAll('{{SEQ}}', seq)
    .replaceAll('{{YEAR}}', String(year));
}

function requiredText(value: unknown, field: string) {
  const text = String(value ?? '').trim();
  if (!text) throw new BadRequestException(`${field} e obrigatorio.`);
  return text;
}

function nullableText(value: unknown) {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text || null;
}

function positiveInt(value: unknown, fallback: number) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) throw new BadRequestException('Valor numerico invalido.');
  return Math.round(n);
}

function optionalPositiveInt(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  return positiveInt(value, 1);
}

function parseType(value: unknown): DocumentType | undefined {
  if (!value) return undefined;
  if (!Object.values(DocumentType).includes(value as DocumentType)) {
    throw new BadRequestException('Tipo de documento invalido.');
  }
  return value as DocumentType;
}
