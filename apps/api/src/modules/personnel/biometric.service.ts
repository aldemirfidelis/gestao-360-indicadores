import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditWriterService } from '../../common/audit/audit-writer.service';
import { decryptJson, encryptJson } from '../../common/crypto';
import { AuthPayload } from '../auth/auth.types';
import { PersonnelService } from './personnel.service';
import { DEFAULT_FACE_THRESHOLD, euclideanDistance, meanDescriptor, validateDescriptor } from './biometric.logic';

const NOTICE_VERSION = 'facial-clock-v1-2026-07';
const CHALLENGE_TTL_MS = 2 * 60_000;
const LOCK_MS = 15 * 60_000;
const MAX_FAILURES = 5;
// Fluxo simplificado a pedido do negócio: sem prova de vivacidade (piscar/
// virar o rosto). O desafio de uso único + expiração continua como antirreplay.
const LIVENESS_ACTION_NONE = 'NONE';

@Injectable()
export class BiometricService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditWriterService,
    private readonly personnel: PersonnelService,
  ) {}

  async status(me: AuthPayload) {
    const profile = await this.prisma.personnelBiometricProfile.findUnique({
      where: { companyId_userId: { companyId: me.companyId, userId: me.sub } },
      select: { status: true, descriptorVersion: true, sampleCount: true, enrolledAt: true, lastVerifiedAt: true, lockedUntil: true, revokedAt: true },
    });
    return { enrolled: profile?.status === 'ACTIVE', profile, noticeVersion: NOTICE_VERSION };
  }

  async challenge(me: AuthPayload, purpose: 'ENROLL' | 'VERIFY_PUNCH') {
    if (!['ENROLL', 'VERIFY_PUNCH'].includes(purpose)) throw new BadRequestException('Finalidade biométrica inválida.');
    let profile = await this.prisma.personnelBiometricProfile.findUnique({
      where: { companyId_userId: { companyId: me.companyId, userId: me.sub } },
    });
    if (profile?.status === 'LOCKED' && profile.lockedUntil && profile.lockedUntil <= new Date()) {
      profile = await this.prisma.personnelBiometricProfile.update({
        where: { id: profile.id },
        data: { status: 'ACTIVE', failedAttempts: 0, lockedUntil: null },
      });
    }
    if (purpose === 'VERIFY_PUNCH' && (!profile || profile.status !== 'ACTIVE')) {
      throw new ConflictException('Cadastre sua biometria facial antes de registrar o ponto facial.');
    }
    if (profile?.lockedUntil && profile.lockedUntil > new Date()) throw new ForbiddenException('Biometria temporariamente bloqueada por tentativas inválidas.');

    const nonce = randomBytes(24).toString('base64url');
    const item = await this.prisma.personnelBiometricChallenge.create({
      data: {
        companyId: me.companyId,
        userId: me.sub,
        purpose,
        nonceHash: sha256(nonce),
        livenessAction: LIVENESS_ACTION_NONE,
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
      },
    });
    return { id: item.id, nonce, purpose, expiresAt: item.expiresAt, noticeVersion: NOTICE_VERSION };
  }

  async enroll(me: AuthPayload, body: any = {}) {
    if (body?.acceptedPrivacyNotice !== true || body?.noticeVersion !== NOTICE_VERSION) {
      throw new BadRequestException('Leia e aceite o aviso de privacidade específico da biometria facial.');
    }
    await this.consumeChallenge(me, body, 'ENROLL');

    let descriptor: number[];
    try { descriptor = meanDescriptor(body?.descriptors); } catch (error: any) { throw new BadRequestException(error.message); }
    const now = new Date();
    const profile = await this.prisma.personnelBiometricProfile.upsert({
      where: { companyId_userId: { companyId: me.companyId, userId: me.sub } },
      create: {
        companyId: me.companyId,
        userId: me.sub,
        descriptorEnc: encryptJson({ descriptor }),
        sampleCount: body.descriptors.length,
        threshold: DEFAULT_FACE_THRESHOLD,
        legalBasis: String(body?.legalBasis || 'CONSENTIMENTO_ESPECIFICO'),
        privacyNoticeHash: sha256(NOTICE_VERSION),
        consentAt: now,
        consentById: me.sub,
      },
      update: {
        status: 'ACTIVE', descriptorEnc: encryptJson({ descriptor }), sampleCount: body.descriptors.length,
        legalBasis: String(body?.legalBasis || 'CONSENTIMENTO_ESPECIFICO'), privacyNoticeHash: sha256(NOTICE_VERSION),
        consentAt: now, consentById: me.sub, enrolledAt: now, revokedAt: null, revokedById: null,
        revocationReason: null, failedAttempts: 0, lockedUntil: null,
      },
      select: { id: true, status: true, enrolledAt: true, sampleCount: true },
    });
    await this.audit.record(me, { module: 'personnel', entity: 'PersonnelBiometricProfile', entityId: profile.id, action: 'BIOMETRIC_ENROLLED', message: 'Biometria facial cadastrada sem retenção de fotografia', after: { sampleCount: profile.sampleCount, noticeVersion: NOTICE_VERSION } });
    return profile;
  }

  async verifyAndPunch(me: AuthPayload, body: any, ctx: { ip?: string; userAgent?: string }) {
    const challenge = await this.consumeChallenge(me, body, 'VERIFY_PUNCH');
    const profile = await this.prisma.personnelBiometricProfile.findUnique({ where: { companyId_userId: { companyId: me.companyId, userId: me.sub } } });
    if (!profile || profile.status !== 'ACTIVE') throw new NotFoundException('Biometria facial ativa não encontrada.');
    if (profile.lockedUntil && profile.lockedUntil > new Date()) throw new ForbiddenException('Biometria temporariamente bloqueada.');

    let distance: number | null = null;
    let matched = false;
    try {
      const probe = validateDescriptor(body?.descriptor);
      const stored = decryptJson<{ descriptor: number[] }>(profile.descriptorEnc).descriptor;
      distance = euclideanDistance(stored, probe);
      matched = distance <= profile.threshold;
    } catch { matched = false; }

    const attempt = await this.prisma.personnelBiometricAttempt.create({
      data: {
        companyId: me.companyId, userId: me.sub, challengeId: challenge.id, purpose: 'VERIFY_PUNCH',
        status: matched ? 'MATCH' : 'NO_MATCH', distance,
        threshold: profile.threshold, livenessAction: LIVENESS_ACTION_NONE, livenessPassed: matched,
        latitude: finiteOrNull(body?.latitude), longitude: finiteOrNull(body?.longitude), accuracy: finiteOrNull(body?.accuracy),
        ip: ctx.ip ?? null, userAgent: ctx.userAgent?.slice(0, 500) ?? null,
      },
    });
    if (!matched) {
      const failures = profile.failedAttempts + 1;
      await this.prisma.personnelBiometricProfile.update({
        where: { id: profile.id },
        data: { failedAttempts: failures, ...(failures >= MAX_FAILURES ? { status: 'LOCKED', lockedUntil: new Date(Date.now() + LOCK_MS) } : {}) },
      });
      await this.audit.record(me, { module: 'personnel', entity: 'PersonnelBiometricAttempt', entityId: attempt.id, action: 'BIOMETRIC_REJECTED', message: 'Verificação facial recusada', after: { status: attempt.status, distance } });
      throw new ForbiddenException('Rosto não confirmado. Tente novamente em boa iluminação ou use o registro de ponto convencional.');
    }

    await this.prisma.personnelBiometricProfile.update({ where: { id: profile.id }, data: { lastVerifiedAt: new Date(), failedAttempts: 0, lockedUntil: null, status: 'ACTIVE' } });
    return this.personnel.punch(me, body, { ...ctx, verifiedBiometricAttemptId: attempt.id });
  }

  async revoke(me: AuthPayload, body: any = {}) {
    const profile = await this.prisma.personnelBiometricProfile.findUnique({ where: { companyId_userId: { companyId: me.companyId, userId: me.sub } } });
    if (!profile) throw new NotFoundException('Biometria não encontrada.');
    const reason = String(body?.reason ?? 'Revogação solicitada pelo titular').trim().slice(0, 500);
    await this.prisma.personnelBiometricProfile.update({ where: { id: profile.id }, data: { status: 'REVOKED', descriptorEnc: encryptJson({ descriptor: [] }), revokedAt: new Date(), revokedById: me.sub, revocationReason: reason } });
    await this.audit.record(me, { module: 'personnel', entity: 'PersonnelBiometricProfile', entityId: profile.id, action: 'BIOMETRIC_REVOKED', message: reason });
    return { revoked: true };
  }

  private async consumeChallenge(me: AuthPayload, body: any, purpose: string) {
    const challenge = await this.prisma.personnelBiometricChallenge.findFirst({ where: { id: String(body?.challengeId ?? ''), companyId: me.companyId, userId: me.sub, purpose } });
    if (!challenge || challenge.usedAt || challenge.expiresAt <= new Date() || challenge.nonceHash !== sha256(String(body?.nonce ?? ''))) {
      throw new ForbiddenException('Desafio biométrico inválido ou expirado.');
    }
    return this.prisma.personnelBiometricChallenge.update({ where: { id: challenge.id }, data: { usedAt: new Date(), attempts: { increment: 1 } } });
  }
}

function sha256(value: string) { return createHash('sha256').update(value).digest('hex'); }
function finiteOrNull(value: unknown): number | null { const n = Number(value); return Number.isFinite(n) ? n : null; }
