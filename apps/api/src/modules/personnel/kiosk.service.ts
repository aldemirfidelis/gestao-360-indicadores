import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  PreconditionFailedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { UserRoleEnum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditWriterService } from '../../common/audit/audit-writer.service';
import { decryptJson } from '../../common/crypto';
import { AuthPayload } from '../auth/auth.types';
import { PersonnelService } from './personnel.service';
import { euclideanDistance, validateDescriptor } from './biometric.logic';

const MODULE = 'personnel';
const CHALLENGE_TTL_MS = 90_000;
const DEFAULT_TOKEN_DAYS = 90;
const MAX_ACTIVE_PROFILES = 5_000;
const MODEL_VERSION = 'face-api-128-v1';
const MIN_MATCH_MARGIN = 0.06;
const DEFAULT_KIOSK_THRESHOLD = 0.42;

type RequestContext = { ip?: string; userAgent?: string };

/**
 * Totem compartilhado para piloto controlado. O recurso fica desligado até
 * PERSONNEL_KIOSK_ENABLED=true porque o pipeline atual não possui PAD/prova de
 * vida certificada. Challenge de uso único reduz replay de requisição, mas não
 * transforma o reconhecimento facial em solução antifraude certificada.
 */
@Injectable()
export class KioskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriterService,
    private readonly personnel: PersonnelService,
  ) {}

  // ------------------------------ Dispositivos ------------------------------

  async createDevice(me: AuthPayload, body: any = {}) {
    const name = requiredText(body?.name, 'Nome do totem', 120);
    const branchId = optionalText(body?.branchId, 120);
    if (branchId) {
      const branch = await this.prisma.branch.findFirst({ where: { id: branchId, companyId: me.companyId, active: true, deletedAt: null } });
      if (!branch) throw new NotFoundException('Unidade do totem não encontrada ou inativa.');
    }
    const geo = parseGeofence(body);
    const tokenDays = boundedInt(body?.tokenDays, 1, 365, DEFAULT_TOKEN_DAYS);
    const token = randomBytes(32).toString('base64url');
    const tokenExpiresAt = new Date(Date.now() + tokenDays * 86_400_000);
    const device = await this.prisma.personnelKioskDevice.create({
      data: {
        companyId: me.companyId,
        branchId,
        name,
        tokenHash: sha256(token),
        tokenExpiresAt,
        latitude: geo?.latitude ?? null,
        longitude: geo?.longitude ?? null,
        radiusMeters: geo?.radiusMeters ?? null,
        createdById: me.sub,
      },
      select: deviceSelect,
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'PersonnelKioskDevice',
      entityId: device.id,
      action: 'CREATE',
      message: `Totem de ponto "${name}" criado`,
      after: { branchId, tokenExpiresAt, geofenceConfigured: Boolean(geo) },
    });
    return { device, token };
  }

  async listDevices(me: AuthPayload) {
    return this.prisma.personnelKioskDevice.findMany({
      where: { companyId: me.companyId },
      select: deviceSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async setDeviceActive(me: AuthPayload, id: string, body: any = {}) {
    const device = await this.deviceForCompany(me.companyId, id);
    const active = strictBoolean(body?.active, 'Situação do totem');
    const updated = await this.prisma.personnelKioskDevice.update({ where: { id }, data: { active }, select: deviceSelect });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'PersonnelKioskDevice',
      entityId: id,
      action: active ? 'ENABLE' : 'DISABLE',
      message: `Totem "${device.name}" ${active ? 'ativado' : 'desativado'}`,
    });
    return updated;
  }

  async deleteDevice(me: AuthPayload, id: string) {
    const device = await this.deviceForCompany(me.companyId, id);
    await this.prisma.personnelKioskDevice.delete({ where: { id } });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'PersonnelKioskDevice',
      entityId: id,
      action: 'DELETE',
      message: `Totem de ponto "${device.name}" excluído`,
    });
  }

  async rotateDeviceToken(me: AuthPayload, id: string, body: any = {}) {
    const device = await this.deviceForCompany(me.companyId, id);
    const tokenDays = boundedInt(body?.tokenDays, 1, 365, DEFAULT_TOKEN_DAYS);
    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    const tokenExpiresAt = new Date(now.getTime() + tokenDays * 86_400_000);
    const updated = await this.prisma.personnelKioskDevice.update({
      where: { id },
      data: { tokenHash: sha256(token), tokenExpiresAt, lastRotatedAt: now },
      select: deviceSelect,
    });
    await this.audit.record(me, {
      module: MODULE,
      entity: 'PersonnelKioskDevice',
      entityId: id,
      action: 'ROTATE_CREDENTIAL',
      message: `Credencial do totem "${device.name}" rotacionada`,
      after: { tokenExpiresAt },
    });
    return { device: updated, token };
  }

  // ------------------------------ Challenge + identificação 1:N ------------------------------

  async challenge(deviceToken: string) {
    this.assertEnabled();
    const device = await this.authenticateDevice(deviceToken);
    const nonce = randomBytes(32).toString('base64url');
    const item = await this.prisma.personnelKioskChallenge.create({
      data: {
        companyId: device.companyId,
        deviceId: device.id,
        nonceHash: sha256(nonce),
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
      },
      select: { id: true, expiresAt: true },
    });
    await this.prisma.personnelKioskDevice.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
    return {
      id: item.id,
      nonce,
      expiresAt: item.expiresAt,
      descriptorVersion: MODEL_VERSION,
      antiSpoofing: 'NOT_VERIFIED',
    };
  }

  async identifyAndPunch(deviceToken: string, body: any = {}, ctx: RequestContext) {
    this.assertEnabled();
    const device = await this.authenticateDevice(deviceToken);
    const syncId = validSyncId(body?.syncId);

    // Recuperação idempotente depois de timeout no terminal.
    const existing = await this.prisma.timeClockEntry.findFirst({
      where: { companyId: device.companyId, deviceId: device.id, syncId },
    });
    if (existing) return this.safeExistingResult(existing);

    const challengeId = requiredText(body?.challengeId, 'Desafio', 120);
    const nonce = requiredText(body?.nonce, 'Nonce', 200);
    if (body?.descriptorVersion !== MODEL_VERSION) throw new BadRequestException('Versão do modelo facial incompatível.');
    if (Number(body?.faceCount) !== 1) throw new BadRequestException('A captura deve conter exatamente um rosto.');
    const detectionScore = Number(body?.detectionScore);
    if (!Number.isFinite(detectionScore) || detectionScore < 0.7 || detectionScore > 1) {
      throw new BadRequestException('Qualidade da detecção facial insuficiente.');
    }

    const consumed = await this.prisma.personnelKioskChallenge.updateMany({
      where: {
        id: challengeId,
        companyId: device.companyId,
        deviceId: device.id,
        nonceHash: sha256(nonce),
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date(), syncId },
    });
    if (consumed.count !== 1) throw new ForbiddenException('Desafio do totem inválido, expirado ou já utilizado.');

    let probe: number[];
    try {
      probe = validateDescriptor(body?.descriptor);
    } catch (error: any) {
      throw new BadRequestException(error?.message ?? 'Descritor facial inválido.');
    }

    const location = parseLocation(body);
    this.assertGeofence(device, location);

    const users = await this.prisma.user.findMany({
      where: {
        companyId: device.companyId,
        active: true,
        deletedAt: null,
        ...(device.branchId ? { branchId: device.branchId } : {}),
      },
      select: { id: true, name: true, email: true, role: true },
      take: MAX_ACTIVE_PROFILES + 1,
    });
    if (users.length > MAX_ACTIVE_PROFILES) throw new ServiceUnavailableException('Escopo do totem excede o limite seguro do piloto.');
    const userById = new Map(users.map((user) => [user.id, user]));
    const profiles = await this.prisma.personnelBiometricProfile.findMany({
      where: {
        companyId: device.companyId,
        userId: { in: users.map((user) => user.id) },
        status: 'ACTIVE',
        descriptorVersion: MODEL_VERSION,
        OR: [{ lockedUntil: null }, { lockedUntil: { lte: new Date() } }],
      },
      select: { id: true, userId: true, descriptorEnc: true, threshold: true },
    });
    if (!profiles.length) throw new NotFoundException('Nenhum colaborador elegível com biometria ativa neste terminal.');

    let best: { profileId: string; userId: string; distance: number; threshold: number } | null = null;
    let secondDistance = Number.POSITIVE_INFINITY;
    for (const profile of profiles) {
      try {
        const stored = decryptJson<{ descriptor: number[] }>(profile.descriptorEnc).descriptor;
        const distance = euclideanDistance(stored, probe);
        const threshold = Math.min(profile.threshold, kioskThreshold());
        if (!best || distance < best.distance) {
          secondDistance = best?.distance ?? Number.POSITIVE_INFINITY;
          best = { profileId: profile.id, userId: profile.userId, distance, threshold };
        } else if (distance < secondDistance) {
          secondDistance = distance;
        }
      } catch {
        // Template corrompido é ignorado; nunca é devolvido/logado.
      }
    }

    const unambiguous = Boolean(best) && (secondDistance === Number.POSITIVE_INFINITY || secondDistance - best!.distance >= MIN_MATCH_MARGIN);
    const matched = Boolean(best) && best!.distance <= best!.threshold && unambiguous;
    const attempt = await this.prisma.personnelBiometricAttempt.create({
      data: {
        companyId: device.companyId,
        userId: best?.userId ?? `kiosk:${device.id}`,
        challengeId,
        purpose: 'KIOSK_PUNCH',
        status: matched ? 'MATCH' : unambiguous ? 'NO_MATCH' : 'AMBIGUOUS',
        distance: best?.distance ?? null,
        threshold: best?.threshold ?? null,
        livenessAction: 'NOT_VERIFIED',
        livenessPassed: false,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        ip: ctx.ip ?? null,
        userAgent: `kiosk:${device.id} | ${String(ctx.userAgent ?? '').slice(0, 400)}`,
      },
    });

    if (!matched || !best) {
      await this.audit.record({ companyId: device.companyId, sub: null }, {
        module: MODULE,
        entity: 'PersonnelBiometricAttempt',
        entityId: attempt.id,
        action: 'KIOSK_FACE_REJECTED',
        result: 'DENIED',
        after: { deviceId: device.id, status: attempt.status },
      });
      throw new ForbiddenException('Rosto não reconhecido com segurança. Use o registro convencional ou procure o RH.');
    }

    const user = userById.get(best.userId);
    if (!user) throw new ForbiddenException('Colaborador não elegível neste terminal.');
    const payload: AuthPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRoleEnum,
      companyId: device.companyId,
    };

    try {
      const result = await this.personnel.punch(
        payload,
        {
          syncId,
          deviceId: device.id,
          deviceTime: body?.deviceTime,
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          note: `Totem ${device.name}`,
        },
        {
          ip: ctx.ip,
          userAgent: ctx.userAgent,
          verifiedBiometricAttemptId: attempt.id,
          sourceOverride: 'FACIAL_KIOSK',
          createdById: null,
          auditActor: { companyId: device.companyId, sub: null },
        },
      );
      await Promise.all([
        this.prisma.personnelBiometricProfile.update({
          where: { id: best.profileId },
          data: { lastVerifiedAt: new Date(), failedAttempts: 0 },
        }),
        this.prisma.personnelKioskChallenge.update({
          where: { id: challengeId },
          data: { entryId: result.entry.id },
        }),
        this.prisma.personnelKioskDevice.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } }),
      ]);
      return {
        user: { name: displayName(user.name) },
        entry: {
          id: result.entry.id,
          punchedAt: result.entry.punchedAt,
          kind: result.entry.kind,
          nsr: result.entry.nsr,
        },
        day: { status: result.day.status, workedMinutes: result.day.workedMinutes, nextKind: result.day.nextKind },
        idempotent: result.idempotent,
      };
    } catch (error) {
      await this.prisma.personnelBiometricAttempt.update({ where: { id: attempt.id }, data: { status: 'MATCH_PUNCH_REJECTED' } });
      throw error;
    }
  }

  private assertEnabled() {
    if (process.env.PERSONNEL_KIOSK_ENABLED !== 'true') {
      // 412 (não 5xx): o filtro global mascara mensagens de erro >=500 em produção
      // para não vazar detalhes de falhas reais. Esta é uma configuração esperada
      // e precisa continuar visível no totem/log do frontend.
      throw new PreconditionFailedException('Totem facial indisponível: piloto não habilitado pelo administrador do ambiente.');
    }
  }

  private async authenticateDevice(token: string) {
    if (!token || token.length < 32 || token.length > 200) throw new ForbiddenException('Totem não autorizado.');
    const device = await this.prisma.personnelKioskDevice.findUnique({ where: { tokenHash: sha256(token) } });
    if (!device || !device.active || device.tokenExpiresAt <= new Date()) throw new ForbiddenException('Totem não autorizado.');
    return device;
  }

  private async deviceForCompany(companyId: string, id: string) {
    const device = await this.prisma.personnelKioskDevice.findFirst({ where: { id, companyId } });
    if (!device) throw new NotFoundException('Totem não encontrado.');
    return device;
  }

  private assertGeofence(
    device: { latitude: number | null; longitude: number | null; radiusMeters: number | null },
    location: { latitude: number | null; longitude: number | null; accuracy: number | null },
  ) {
    if (device.latitude == null || device.longitude == null || device.radiusMeters == null) return;
    if (location.latitude == null || location.longitude == null) throw new ForbiddenException('Localização obrigatória para este terminal.');
    const distance = distanceMeters(device.latitude, device.longitude, location.latitude, location.longitude);
    const uncertainty = Math.max(0, location.accuracy ?? 0);
    if (distance - uncertainty > device.radiusMeters) throw new ForbiddenException('Dispositivo fora da área autorizada do terminal.');
  }

  private async safeExistingResult(entry: { id: string; companyId: string; userId: string; deviceId: string | null; punchedAt: Date; kind: string; nsr: bigint; dayKey: string }) {
    const user = await this.prisma.user.findFirst({ where: { id: entry.userId, companyId: entry.companyId }, select: { name: true } });
    return {
      user: { name: displayName(user?.name ?? 'Colaborador') },
      entry: { id: entry.id, punchedAt: entry.punchedAt, kind: entry.kind, nsr: entry.nsr.toString() },
      day: null,
      idempotent: true,
    };
  }
}

const deviceSelect = {
  id: true,
  name: true,
  branchId: true,
  active: true,
  tokenExpiresAt: true,
  lastRotatedAt: true,
  lastSeenAt: true,
  latitude: true,
  longitude: true,
  radiusMeters: true,
  createdAt: true,
} as const;

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function requiredText(value: unknown, label: string, max: number) {
  const text = String(value ?? '').trim();
  if (!text) throw new BadRequestException(`${label} é obrigatório.`);
  if (text.length > max) throw new BadRequestException(`${label} excede ${max} caracteres.`);
  return text;
}

function optionalText(value: unknown, max: number): string | null {
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (text.length > max) throw new BadRequestException(`Valor excede ${max} caracteres.`);
  return text;
}

function strictBoolean(value: unknown, label: string): boolean {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  throw new BadRequestException(`${label} inválida.`);
}

function boundedInt(value: unknown, min: number, max: number, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new BadRequestException(`Valor deve estar entre ${min} e ${max}.`);
  return number;
}

function validSyncId(value: unknown): string {
  const syncId = String(value ?? '').trim();
  if (syncId.length < 8 || syncId.length > 120 || !/^[A-Za-z0-9._:-]+$/.test(syncId)) {
    throw new BadRequestException('Identificador de sincronização inválido.');
  }
  return syncId;
}

function parseGeofence(body: any): { latitude: number; longitude: number; radiusMeters: number } | null {
  const hasAny = body?.latitude !== undefined || body?.longitude !== undefined || body?.radiusMeters !== undefined;
  if (!hasAny) return null;
  const latitude = Number(body?.latitude);
  const longitude = Number(body?.longitude);
  const radiusMeters = Number(body?.radiusMeters);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new BadRequestException('Latitude do totem inválida.');
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new BadRequestException('Longitude do totem inválida.');
  if (!Number.isInteger(radiusMeters) || radiusMeters < 25 || radiusMeters > 5_000) throw new BadRequestException('Raio deve estar entre 25 e 5.000 metros.');
  return { latitude, longitude, radiusMeters };
}

function parseLocation(body: any) {
  const latitude = nullableFinite(body?.latitude, -90, 90, 'Latitude');
  const longitude = nullableFinite(body?.longitude, -180, 180, 'Longitude');
  const accuracy = nullableFinite(body?.accuracy, 0, 50_000, 'Precisão');
  if ((latitude == null) !== (longitude == null)) throw new BadRequestException('Latitude e longitude devem ser enviadas juntas.');
  return { latitude, longitude, accuracy };
}

function nullableFinite(value: unknown, min: number, max: number, label: string): number | null {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new BadRequestException(`${label} inválida.`);
  return number;
}

function kioskThreshold() {
  const configured = Number(process.env.PERSONNEL_KIOSK_FACE_THRESHOLD);
  return Number.isFinite(configured) && configured >= 0.25 && configured <= 0.48 ? configured : DEFAULT_KIOSK_THRESHOLD;
}

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function displayName(name: string) {
  return name.trim().split(/\s+/)[0] || 'Colaborador';
}
