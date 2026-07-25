import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
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
const ADMIN_ENROLL_PURPOSE = 'ADMIN_ENROLL';

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

  /**
   * Base administrativa de biometria por colaborador/matrícula. O login é
   * deliberadamente um detalhe técnico e não participa da experiência de
   * cadastramento.
   */
  async listEmployeeProfiles(me: AuthPayload, filters: { search?: string; biometricStatus?: string } = {}) {
    const term = String(filters.search ?? '').trim();
    const employees = await this.prisma.orgEmployee.findMany({
      where: {
        companyId: me.companyId,
        ...(term
          ? {
              OR: [
                { name: { contains: term, mode: 'insensitive' } },
                { registrationId: { contains: term, mode: 'insensitive' } },
                { personnelProfile: { cpf: { contains: term.replace(/\D/g, '') || term } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        registrationId: true,
        status: true,
        orgNode: { select: { id: true, name: true } },
        biometricProfile: {
          select: {
            id: true,
            status: true,
            descriptorVersion: true,
            sampleCount: true,
            enrolledAt: true,
            lastVerifiedAt: true,
            lockedUntil: true,
            revokedAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      take: 500,
    });
    const status = String(filters.biometricStatus ?? '').trim().toUpperCase();
    const items = status
      ? employees.filter((employee) => {
          if (status === 'PENDING') return !employee.biometricProfile || employee.biometricProfile.status === 'REVOKED';
          if (status === 'ACTIVE') return employee.biometricProfile?.status === 'ACTIVE';
          return employee.biometricProfile?.status === status;
        })
      : employees;
    return {
      items,
      summary: {
        total: employees.length,
        active: employees.filter((employee) => employee.biometricProfile?.status === 'ACTIVE').length,
        pending: employees.filter((employee) => !employee.biometricProfile || employee.biometricProfile.status === 'REVOKED').length,
      },
      noticeVersion: NOTICE_VERSION,
    };
  }

  async employeeEnrollmentChallenge(me: AuthPayload, employeeId: string) {
    await this.employeeForCompany(me.companyId, employeeId);
    const nonce = randomBytes(24).toString('base64url');
    const item = await this.prisma.personnelBiometricChallenge.create({
      data: {
        companyId: me.companyId,
        userId: me.sub,
        employeeId,
        purpose: ADMIN_ENROLL_PURPOSE,
        nonceHash: sha256(nonce),
        livenessAction: LIVENESS_ACTION_NONE,
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
      },
    });
    return { id: item.id, nonce, purpose: item.purpose, expiresAt: item.expiresAt, noticeVersion: NOTICE_VERSION };
  }

  async enrollEmployee(me: AuthPayload, employeeId: string, body: any = {}) {
    if (body?.acceptedPrivacyNotice !== true || body?.noticeVersion !== NOTICE_VERSION) {
      throw new BadRequestException('Confirme que o colaborador foi informado sobre o tratamento da biometria facial.');
    }
    const employee = await this.employeeForCompany(me.companyId, employeeId);
    if (employee.status !== 'ACTIVE') throw new ConflictException('Somente colaboradores ativos podem cadastrar biometria.');
    await this.consumeEmployeeChallenge(me, employeeId, body);

    let descriptor: number[];
    try {
      descriptor = meanDescriptor(body?.descriptors);
    } catch (error: any) {
      throw new BadRequestException(error.message);
    }

    const userId = await this.ensureClockIdentity(me, employee);
    const collision = await this.prisma.personnelBiometricProfile.findFirst({
      where: {
        companyId: me.companyId,
        OR: [{ employeeId }, { userId }],
      },
    });
    if (collision?.employeeId && collision.employeeId !== employeeId) {
      throw new ConflictException('A identidade técnica já possui biometria vinculada a outro colaborador.');
    }

    const now = new Date();
    const data = {
      employeeId,
      userId,
      status: 'ACTIVE',
      descriptorEnc: encryptJson({ descriptor }),
      descriptorVersion: 'face-api-128-v1',
      sampleCount: body.descriptors.length,
      threshold: DEFAULT_FACE_THRESHOLD,
      legalBasis: String(body?.legalBasis || 'CONSENTIMENTO_ESPECIFICO'),
      privacyNoticeHash: sha256(NOTICE_VERSION),
      consentAt: now,
      consentById: me.sub,
      enrolledAt: now,
      revokedAt: null,
      revokedById: null,
      revocationReason: null,
      failedAttempts: 0,
      lockedUntil: null,
    };
    const profile = collision
      ? await this.prisma.personnelBiometricProfile.update({
          where: { id: collision.id },
          data,
          select: { id: true, status: true, enrolledAt: true, sampleCount: true },
        })
      : await this.prisma.personnelBiometricProfile.create({
          data: { companyId: me.companyId, ...data },
          select: { id: true, status: true, enrolledAt: true, sampleCount: true },
        });
    await this.audit.record(me, {
      module: 'personnel',
      entity: 'PersonnelBiometricProfile',
      entityId: profile.id,
      action: 'BIOMETRIC_EMPLOYEE_ENROLLED',
      message: `Biometria facial de "${employee.name}" cadastrada por operador autorizado`,
      after: { employeeId, registrationId: employee.registrationId, sampleCount: profile.sampleCount, noticeVersion: NOTICE_VERSION },
    });
    return profile;
  }

  async revokeEmployee(me: AuthPayload, employeeId: string, body: any = {}) {
    const employee = await this.employeeForCompany(me.companyId, employeeId);
    const profile = await this.prisma.personnelBiometricProfile.findFirst({ where: { companyId: me.companyId, employeeId } });
    if (!profile) throw new NotFoundException('Biometria do colaborador não encontrada.');
    const reason = String(body?.reason ?? 'Revogação administrativa').trim().slice(0, 500);
    await this.prisma.personnelBiometricProfile.update({
      where: { id: profile.id },
      data: {
        status: 'REVOKED',
        descriptorEnc: encryptJson({ descriptor: [] }),
        revokedAt: new Date(),
        revokedById: me.sub,
        revocationReason: reason,
      },
    });
    await this.audit.record(me, {
      module: 'personnel',
      entity: 'PersonnelBiometricProfile',
      entityId: profile.id,
      action: 'BIOMETRIC_EMPLOYEE_REVOKED',
      message: `Biometria facial de "${employee.name}" revogada: ${reason}`,
      after: { employeeId },
    });
    return { revoked: true };
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
    const employeeProfile = await this.prisma.personnelEmployeeProfile.findFirst({
      where: { companyId: me.companyId, userId: me.sub },
      select: { employeeId: true },
    });
    const now = new Date();
    const profile = await this.prisma.personnelBiometricProfile.upsert({
      where: { companyId_userId: { companyId: me.companyId, userId: me.sub } },
      create: {
        companyId: me.companyId,
        userId: me.sub,
        employeeId: employeeProfile?.employeeId ?? null,
        descriptorEnc: encryptJson({ descriptor }),
        sampleCount: body.descriptors.length,
        threshold: DEFAULT_FACE_THRESHOLD,
        legalBasis: String(body?.legalBasis || 'CONSENTIMENTO_ESPECIFICO'),
        privacyNoticeHash: sha256(NOTICE_VERSION),
        consentAt: now,
        consentById: me.sub,
      },
      update: {
        status: 'ACTIVE', employeeId: employeeProfile?.employeeId ?? undefined, descriptorEnc: encryptJson({ descriptor }), sampleCount: body.descriptors.length,
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
        companyId: me.companyId, userId: me.sub, employeeId: profile.employeeId, challengeId: challenge.id, purpose: 'VERIFY_PUNCH',
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

  private async consumeEmployeeChallenge(me: AuthPayload, employeeId: string, body: any) {
    const challenge = await this.prisma.personnelBiometricChallenge.findFirst({
      where: {
        id: String(body?.challengeId ?? ''),
        companyId: me.companyId,
        userId: me.sub,
        employeeId,
        purpose: ADMIN_ENROLL_PURPOSE,
      },
    });
    if (!challenge || challenge.usedAt || challenge.expiresAt <= new Date() || challenge.nonceHash !== sha256(String(body?.nonce ?? ''))) {
      throw new ForbiddenException('Desafio de cadastramento facial inválido ou expirado.');
    }
    return this.prisma.personnelBiometricChallenge.update({
      where: { id: challenge.id },
      data: { usedAt: new Date(), attempts: { increment: 1 } },
    });
  }

  private async employeeForCompany(companyId: string, employeeId: string) {
    const employee = await this.prisma.orgEmployee.findFirst({
      where: { id: employeeId, companyId },
      select: {
        id: true,
        companyId: true,
        name: true,
        registrationId: true,
        status: true,
        orgNodeId: true,
        personnelProfile: { select: { id: true, userId: true } },
      },
    });
    if (!employee) throw new NotFoundException('Colaborador não encontrado.');
    return employee;
  }

  /**
   * O motor de jornada ainda usa User como chave técnica. Para colaboradores
   * sem portal, cria uma identidade bloqueada para autenticação e invisível na
   * gestão de usuários. A biometria continua pertencendo ao employeeId.
   */
  private async ensureClockIdentity(
    me: AuthPayload,
    employee: {
      id: string;
      companyId: string;
      name: string;
      registrationId: string | null;
      orgNodeId: string | null;
      personnelProfile: { id: string; userId: string | null } | null;
    },
  ): Promise<string> {
    if (employee.personnelProfile?.userId) {
      const linked = await this.prisma.user.findFirst({
        where: { id: employee.personnelProfile.userId, companyId: me.companyId, deletedAt: null },
        select: { id: true, active: true, serviceAccount: true },
      });
      if (!linked) throw new ConflictException('O vínculo técnico do colaborador está inválido.');
      if (!linked.active && !linked.serviceAccount) throw new ConflictException('O usuário vinculado ao colaborador está inativo.');
      if (!linked.active) await this.prisma.user.update({ where: { id: linked.id }, data: { active: true } });
      return linked.id;
    }

    const employeeProfile = employee.personnelProfile
      ?? await this.prisma.personnelEmployeeProfile.create({
        data: { companyId: me.companyId, employeeId: employee.id, createdById: me.sub },
        select: { id: true, userId: true },
      });
    const email = `clock-${employee.id}@identity.gestao360.invalid`;
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing && (existing.companyId !== me.companyId || !existing.serviceAccount)) {
      throw new ConflictException('Não foi possível reservar a identidade técnica deste colaborador.');
    }
    const rounds = parseInt(process.env.BCRYPT_ROUNDS ?? '10', 10);
    const passwordHash = await bcrypt.hash(randomBytes(32).toString('base64url'), rounds);
    const user = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: { name: employee.name, active: true, status: 'BLOCKED', serviceAccount: true, defaultNodeId: employee.orgNodeId },
        })
      : await this.prisma.user.create({
          data: {
            companyId: me.companyId,
            email,
            passwordHash,
            name: employee.name,
            role: UserRoleEnum.COLLABORATOR,
            status: 'BLOCKED',
            active: true,
            serviceAccount: true,
            defaultNodeId: employee.orgNodeId,
          },
        });
    await this.prisma.personnelEmployeeProfile.update({
      where: { id: employeeProfile.id },
      data: { userId: user.id },
    });
    await this.audit.record(me, {
      module: 'personnel',
      entity: 'OrgEmployee',
      entityId: employee.id,
      action: 'CLOCK_IDENTITY_CREATED',
      message: `Identidade técnica de ponto criada para "${employee.name}" sem acesso ao portal`,
      after: { employeeId: employee.id },
    });
    return user.id;
  }
}

function sha256(value: string) { return createHash('sha256').update(value).digest('hex'); }
function finiteOrNull(value: unknown): number | null { const n = Number(value); return Number.isFinite(n) ? n : null; }
