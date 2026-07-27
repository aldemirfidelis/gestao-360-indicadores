import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { candidateJwtSecret, CANDIDATE_TOKEN_TTL, CandidateTokenPayload } from './recruit-candidate.token';
import {
  type OAuthProfile,
  type OAuthProvider,
  availableProviders,
  buildAuthorizeUrl,
  callbackUrl,
  failureRedirect,
  normalizeOAuthProfile,
  providerConfig,
  safeReturnTo,
  successRedirect,
} from './recruit-candidate-oauth.logic';

/** O state expira rápido: é só a ida e volta até o provedor. */
const STATE_TTL = '10m';

interface StatePayload {
  provider: OAuthProvider;
  returnTo: string;
  nonce: string;
  kind: 'candidate-oauth';
}

/**
 * Login do candidato por Google/LinkedIn (OpenID Connect).
 *
 * O provedor só é oferecido quando as credenciais estão configuradas no
 * ambiente; sem elas o botão nem aparece. A conta é encontrada primeiro pela
 * identidade (provider + id), depois pelo e-mail VERIFICADO — nunca por e-mail
 * não verificado, senão bastaria criar uma conta social com o e-mail de outra
 * pessoa para assumir a candidatura dela.
 */
@Injectable()
export class RecruitCandidateOauthService {
  private readonly logger = new Logger(RecruitCandidateOauthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** Quais botões a tela de login deve mostrar. */
  listProviders() {
    return { providers: availableProviders() };
  }

  /** Monta a URL de autorização do provedor com um state assinado (anti-CSRF). */
  async startUrl(provider: OAuthProvider, returnTo?: string): Promise<string> {
    const config = providerConfig(provider);
    if (!config) throw new BadRequestException('Este login social não está disponível no momento.');

    const payload: StatePayload = {
      provider,
      returnTo: safeReturnTo(returnTo),
      nonce: randomBytes(16).toString('hex'),
      kind: 'candidate-oauth',
    };
    const state = await this.jwt.signAsync(payload, { secret: candidateJwtSecret(), expiresIn: STATE_TTL });
    return buildAuthorizeUrl(config, state, callbackUrl(provider));
  }

  /**
   * Consome o callback do provedor e devolve a URL de destino (com o token no
   * fragmento, em caso de sucesso). Nunca lança: erro vira redirect com aviso,
   * porque quem chega aqui é o navegador do candidato, não um cliente de API.
   */
  async handleCallback(rawProvider: OAuthProvider, query: { code?: string; state?: string; error?: string }): Promise<string> {
    let returnTo = '/candidato';
    try {
      const state = await this.verifyState(query?.state);
      returnTo = state.returnTo;
      if (state.provider !== rawProvider) throw new UnauthorizedException('Requisição inconsistente.');
      if (query?.error) throw new UnauthorizedException('Autorização cancelada.');
      if (!query?.code) throw new BadRequestException('Código de autorização ausente.');

      const config = providerConfig(rawProvider);
      if (!config) throw new BadRequestException('Login social indisponível.');

      const accessToken = await this.exchangeCode(config.tokenUrl, {
        grant_type: 'authorization_code',
        code: query.code,
        redirect_uri: callbackUrl(rawProvider),
        client_id: config.clientId,
        client_secret: config.clientSecret,
      });
      const profile = await this.fetchProfile(config.userInfoUrl, accessToken);
      const candidate = await this.resolveCandidate(rawProvider, profile);
      const token = await this.tokenFor(candidate);
      return successRedirect(returnTo, token);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha no login social.';
      this.logger.warn(`Login social ${rawProvider} falhou: ${message}`);
      return failureRedirect(returnTo, message);
    }
  }

  // ------------------------------ interno ------------------------------

  private async verifyState(state?: string): Promise<StatePayload> {
    if (!state) throw new UnauthorizedException('Sessão de login expirada. Tente novamente.');
    try {
      const payload = await this.jwt.verifyAsync<StatePayload>(state, { secret: candidateJwtSecret() });
      if (payload?.kind !== 'candidate-oauth') throw new Error('kind inválido');
      return { ...payload, returnTo: safeReturnTo(payload.returnTo) };
    } catch {
      throw new UnauthorizedException('Sessão de login expirada. Tente novamente.');
    }
  }

  private async exchangeCode(tokenUrl: string, params: Record<string, string>): Promise<string> {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams(params).toString(),
    });
    const data = (await response.json().catch(() => null)) as { access_token?: string } | null;
    if (!response.ok || !data?.access_token) throw new UnauthorizedException('Não foi possível concluir o login social.');
    return data.access_token;
  }

  private async fetchProfile(userInfoUrl: string, accessToken: string): Promise<OAuthProfile> {
    const response = await fetch(userInfoUrl, { headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' } });
    const data = await response.json().catch(() => null);
    const profile = response.ok ? normalizeOAuthProfile(data) : null;
    if (!profile) throw new UnauthorizedException('Não foi possível ler seu perfil no provedor.');
    return profile;
  }

  /** Identidade existente → conta por e-mail verificado → cria conta nova. */
  private async resolveCandidate(provider: OAuthProvider, profile: OAuthProfile) {
    const identity = await this.prisma.recruitCandidateIdentity.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId: profile.providerAccountId } },
      include: { candidate: true },
    });
    if (identity?.candidate && !identity.candidate.deletedAt && identity.candidate.status === 'ACTIVE') {
      await this.prisma.recruitCandidateIdentity.update({ where: { id: identity.id }, data: { lastLoginAt: new Date(), email: profile.email } });
      await this.prisma.recruitCandidate.update({ where: { id: identity.candidateId }, data: { lastLoginAt: new Date() } });
      return identity.candidate;
    }

    if (!profile.email || !profile.emailVerified) {
      throw new UnauthorizedException('O provedor não confirmou seu e-mail. Cadastre-se com e-mail e senha.');
    }

    const existing = await this.prisma.recruitCandidate.findFirst({
      where: { emailNormalized: profile.email, deletedAt: null },
    });
    if (existing) {
      if (existing.status !== 'ACTIVE') throw new UnauthorizedException('Esta conta não está ativa.');
      await this.linkIdentity(existing.id, provider, profile);
      await this.prisma.recruitCandidate.update({
        where: { id: existing.id },
        // Entrar por provedor que confirma o e-mail vale como verificação.
        data: { lastLoginAt: new Date(), emailVerifiedAt: existing.emailVerifiedAt ?? new Date() },
      });
      return existing;
    }

    const created = await this.prisma.recruitCandidate.create({
      data: {
        email: profile.email,
        emailNormalized: profile.email,
        name: profile.name ?? profile.email.split('@')[0],
        emailVerifiedAt: new Date(),
        lastLoginAt: new Date(),
        // Sem passwordHash: a conta entra só pelo provedor até definir uma senha
        // por "esqueci minha senha".
      },
    });
    await this.linkIdentity(created.id, provider, profile);
    return created;
  }

  private async linkIdentity(candidateId: string, provider: OAuthProvider, profile: OAuthProfile) {
    await this.prisma.recruitCandidateIdentity.upsert({
      where: { provider_providerAccountId: { provider, providerAccountId: profile.providerAccountId } },
      update: { candidateId, email: profile.email, lastLoginAt: new Date() },
      create: { candidateId, provider, providerAccountId: profile.providerAccountId, email: profile.email, lastLoginAt: new Date() },
    });
  }

  private async tokenFor(candidate: { id: string; email: string }): Promise<string> {
    const payload: CandidateTokenPayload = { sub: candidate.id, email: candidate.email, kind: 'candidate' };
    return this.jwt.signAsync(payload, { secret: candidateJwtSecret(), expiresIn: CANDIDATE_TOKEN_TTL });
  }
}
