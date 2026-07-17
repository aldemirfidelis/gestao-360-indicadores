import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditWriterService } from '../../common/audit/audit-writer.service';
import { AuthPayload } from '../auth/auth.types';
import { formatRegistration, sanitizeRegistrationFormat } from './personnel-settings.logic';

const MODULE = 'personnel';

/** Campos booleanos/texto do template do crachá aceitos no update. */
const BADGE_BOOL_FIELDS = ['badgeShowPhoto', 'badgeShowQr', 'badgeShowJob', 'badgeShowAdmission', 'badgeShowRegistration'] as const;

@Injectable()
export class PersonnelSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriterService,
  ) {}

  /** Retorna (criando sob demanda) a configuração da empresa. */
  async get(companyId: string) {
    return this.prisma.personnelSettings.upsert({
      where: { companyId },
      create: { companyId },
      update: {},
    });
  }

  async update(me: AuthPayload, body: Record<string, any> = {}) {
    await this.get(me.companyId);
    const fmt = sanitizeRegistrationFormat(body);
    const data: Record<string, unknown> = { updatedById: me.sub };

    if (typeof body.autoGenerateRegistration === 'boolean') data.autoGenerateRegistration = body.autoGenerateRegistration;
    if (typeof body.allowManualRegistration === 'boolean') data.allowManualRegistration = body.allowManualRegistration;
    if (typeof body.portalPunchDefault === 'boolean') data.portalPunchDefault = body.portalPunchDefault;
    if (fmt.registrationPrefix !== undefined) data.registrationPrefix = fmt.registrationPrefix;
    if (fmt.registrationSuffix !== undefined) data.registrationSuffix = fmt.registrationSuffix;
    if (fmt.registrationWidth !== undefined) data.registrationWidth = fmt.registrationWidth;
    if (fmt.registrationPadChar !== undefined) data.registrationPadChar = fmt.registrationPadChar;
    if (fmt.registrationNextSequence !== undefined) data.registrationNextSequence = fmt.registrationNextSequence;

    if (typeof body.badgeAccentColor === 'string') data.badgeAccentColor = body.badgeAccentColor.slice(0, 16);
    if (body.badgeOrientation === 'PORTRAIT' || body.badgeOrientation === 'LANDSCAPE') data.badgeOrientation = body.badgeOrientation;
    for (const field of BADGE_BOOL_FIELDS) {
      if (typeof body[field] === 'boolean') data[field] = body[field];
    }
    if ('badgeFooterText' in body) data.badgeFooterText = typeof body.badgeFooterText === 'string' ? body.badgeFooterText.slice(0, 200) : null;

    const saved = await this.prisma.personnelSettings.update({ where: { companyId: me.companyId }, data });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'PersonnelSettings',
      entityId: saved.id,
      action: 'SETTINGS_UPDATE',
      message: 'Configurações do Serviço Pessoal atualizadas',
    });
    return saved;
  }

  /** Preview da próxima matrícula sem consumir o sequencial. */
  async previewNextRegistration(companyId: string) {
    const settings = await this.get(companyId);
    return {
      autoGenerate: settings.autoGenerateRegistration,
      next: formatRegistration(settings.registrationNextSequence, settings),
    };
  }

  /**
   * Aloca a próxima matrícula de forma atômica e única.
   * Incrementa o sequencial sob lock de linha (a transação serializa admissões
   * concorrentes) e evita colisão com matrículas digitadas manualmente,
   * avançando o sequencial até achar um valor livre. Devolve null quando a
   * geração automática está desligada.
   */
  async allocateRegistration(companyId: string): Promise<string | null> {
    const settings = await this.get(companyId);
    if (!settings.autoGenerateRegistration) return null;

    for (let attempt = 0; attempt < 25; attempt += 1) {
      const registration = await this.prisma.$transaction(async (tx) => {
        const row = await tx.personnelSettings.update({
          where: { companyId },
          data: { registrationNextSequence: { increment: 1 } },
          select: { registrationNextSequence: true, registrationPrefix: true, registrationSuffix: true, registrationWidth: true, registrationPadChar: true },
        });
        // O valor alocado é o de antes do incremento.
        const seq = row.registrationNextSequence - 1;
        const value = formatRegistration(seq, row);
        const clash = await tx.orgEmployee.findFirst({
          where: { companyId, registrationId: value },
          select: { id: true },
        });
        return clash ? null : value;
      });
      if (registration) return registration;
    }
    // Fallback improvável: deixa o create seguir sem matrícula gerada.
    return null;
  }
}
