import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHmac, randomInt } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { buildTransport, resolveSmtpConfig, smtpFrom } from '../../common/smtp';
import { RecruitCareersService } from './recruit-careers.service';
import { isValidEmail, normalizeEmail, otpFromInt } from './recruit-candidate.logic';
import { candidateJwtSecret, CANDIDATE_TOKEN_TTL, CandidateTokenPayload } from './recruit-candidate.token';

const OTP_TTL_MS = 10 * 60 * 1000; // 10 min
const OTP_MAX_ATTEMPTS = 5;
const isProd = () => process.env.NODE_ENV === 'production';

/**
 * Autenticação do CANDIDATO (identidade separada). Caminho principal: e-mail + senha
 * (cadastro já autentica, sem código). O fluxo de OTP por e-mail permanece disponível
 * (endpoints request-code/login por code) para um futuro "esqueci minha senha". Token
 * assinado com segredo próprio (nunca confundível com o token interno).
 */
@Injectable()
export class RecruitCandidateAuthService {
  private readonly logger = new Logger(RecruitCandidateAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly careers: RecruitCareersService,
  ) {}

  /** Cadastro do candidato: cria a conta por e-mail + senha e já autentica (sem código). */
  async register(host: string | undefined, empresa: string | undefined, body: any = {}) {
    const company = await this.careers.resolveCompany(host, empresa);
    const email = normalizeEmail(body?.email);
    const name = String(body?.name ?? '').trim();
    const password = String(body?.password ?? '');
    if (!isValidEmail(email)) throw new BadRequestException('E-mail inválido.');
    if (name.length < 2) throw new BadRequestException('Informe seu nome.');
    if (password.length < 6) throw new BadRequestException('A senha deve ter ao menos 6 caracteres.');

    const existing = await this.prisma.recruitCandidate.findFirst({
      where: { companyId: company.id, emailNormalized: email, deletedAt: null },
    });
    if (existing) throw new ConflictException('Já existe uma conta com este e-mail. Faça login com sua senha.');

    const passwordHash = await bcrypt.hash(password, 10);
    const candidate = await this.prisma.recruitCandidate.create({
      data: {
        companyId: company.id,
        email,
        emailNormalized: email,
        name,
        phone: text(body?.phone),
        headline: text(body?.headline),
        city: text(body?.city),
        linkedinUrl: text(body?.linkedinUrl),
        passwordHash,
      },
    });
    // Login imediato: devolve o token, sem passar por código de e-mail.
    return this.tokenFor(candidate.id, company.id, candidate.email, candidate.name);
  }

  /** Solicita um novo código (login sem senha). Resposta neutra p/ não revelar cadastro. */
  async requestOtp(host: string | undefined, empresa: string | undefined, body: any = {}) {
    const company = await this.careers.resolveCompany(host, empresa);
    const email = normalizeEmail(body?.email);
    if (!isValidEmail(email)) throw new BadRequestException('E-mail inválido.');
    const candidate = await this.prisma.recruitCandidate.findFirst({
      where: { companyId: company.id, emailNormalized: email, deletedAt: null, status: 'ACTIVE' },
    });
    if (!candidate) return { sent: true }; // resposta neutra (não confirma existência)
    return this.issueOtp(company.id, candidate.id, candidate.email, 'LOGIN');
  }

  /** Login por OTP ou por senha. Devolve token de candidato. */
  async login(host: string | undefined, empresa: string | undefined, body: any = {}) {
    const company = await this.careers.resolveCompany(host, empresa);
    const email = normalizeEmail(body?.email);
    const candidate = await this.prisma.recruitCandidate.findFirst({
      where: { companyId: company.id, emailNormalized: email, deletedAt: null, status: 'ACTIVE' },
    });
    if (!candidate) throw new UnauthorizedException('Credenciais inválidas.');

    if (body?.code) {
      await this.consumeOtp(candidate.id, String(body.code));
      if (!candidate.emailVerifiedAt) await this.prisma.recruitCandidate.update({ where: { id: candidate.id }, data: { emailVerifiedAt: new Date() } });
    } else if (body?.password && candidate.passwordHash) {
      const ok = await bcrypt.compare(String(body.password), candidate.passwordHash);
      if (!ok) throw new UnauthorizedException('Credenciais inválidas.');
    } else {
      throw new BadRequestException('Informe sua senha.');
    }

    await this.prisma.recruitCandidate.update({ where: { id: candidate.id }, data: { lastLoginAt: new Date() } });
    return this.tokenFor(candidate.id, company.id, candidate.email, candidate.name);
  }

  /** Perfil do candidato autenticado. */
  async me(candidateId: string) {
    const c = await this.prisma.recruitCandidate.findUnique({
      where: { id: candidateId },
      select: { id: true, email: true, name: true, phone: true, headline: true, city: true, linkedinUrl: true, portfolioUrl: true, profileData: true, emailVerifiedAt: true, createdAt: true },
    });
    if (!c) throw new NotFoundException('Candidato não encontrado.');
    return c;
  }

  /** Atualiza o perfil reutilizável do candidato. */
  async updateProfile(candidateId: string, body: any = {}) {
    const data: Record<string, unknown> = {};
    for (const f of ['name', 'phone', 'headline', 'city', 'linkedinUrl', 'portfolioUrl'] as const) {
      if (f in body) data[f] = f === 'name' ? String(body[f] ?? '').trim() || undefined : text(body[f]);
    }
    if ('profileData' in body && body.profileData && typeof body.profileData === 'object') data.profileData = body.profileData;
    await this.prisma.recruitCandidate.update({ where: { id: candidateId }, data });
    return this.me(candidateId);
  }

  // ------------------------------ OTP interno ------------------------------

  private async issueOtp(companyId: string, candidateId: string, email: string, purpose: 'LOGIN' | 'VERIFY' | 'RESET') {
    const code = otpFromInt(randomInt(0, 1_000_000));
    await this.prisma.recruitCandidateOtp.create({
      data: { companyId, candidateId, purpose, codeHash: hashCode(candidateId, code), expiresAt: new Date(Date.now() + OTP_TTL_MS) },
    });
    const delivered = await this.sendCode(email, code);
    this.logger.log(`OTP ${purpose} p/ candidato ${candidateId} (entregue via ${delivered ? 'e-mail' : 'log'}).`);
    return { sent: true, email: maskEmail(email), ...(isProd() || delivered ? {} : { devCode: code }) };
  }

  private async consumeOtp(candidateId: string, code: string) {
    const otp = await this.prisma.recruitCandidateOtp.findFirst({
      where: { candidateId, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) throw new UnauthorizedException('Código expirado ou inexistente. Solicite um novo.');
    if (otp.attempts >= OTP_MAX_ATTEMPTS) throw new UnauthorizedException('Muitas tentativas. Solicite um novo código.');
    if (otp.codeHash !== hashCode(candidateId, String(code).trim())) {
      await this.prisma.recruitCandidateOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      throw new UnauthorizedException('Código incorreto.');
    }
    await this.prisma.recruitCandidateOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
  }

  private async tokenFor(candidateId: string, companyId: string, email: string, name: string) {
    const payload: CandidateTokenPayload = { sub: candidateId, companyId, email, kind: 'candidate' };
    const token = await this.jwt.signAsync(payload, { secret: candidateJwtSecret(), expiresIn: CANDIDATE_TOKEN_TTL });
    return { token, candidate: { id: candidateId, email, name } };
  }

  /** Envia o código por e-mail se houver SMTP; senão retorna false (cai no log/devCode). */
  private async sendCode(email: string, code: string): Promise<boolean> {
    try {
      const cfg = await resolveSmtpConfig(this.prisma);
      if (!cfg?.host) return false;
      const transporter = buildTransport(cfg);
      await transporter.sendMail({
        from: smtpFrom(cfg),
        to: email,
        subject: `Seu código de acesso: ${code}`,
        text: `Use o código ${code} para acessar o portal de vagas. Ele expira em 10 minutos. Se não foi você, ignore este e-mail.`,
      });
      return true;
    } catch (err) {
      this.logger.warn(`Falha ao enviar OTP por e-mail: ${(err as Error).message}`);
      return false;
    }
  }
}

function hashCode(candidateId: string, code: string): string {
  return createHmac('sha256', candidateJwtSecret()).update(`recruit-otp:${candidateId}:${code}`).digest('hex');
}

function text(v: unknown): string | null {
  const t = String(v ?? '').trim();
  return t || null;
}

function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return email;
  const head = user.slice(0, 2);
  return `${head}${'*'.repeat(Math.max(1, user.length - 2))}@${domain}`;
}
