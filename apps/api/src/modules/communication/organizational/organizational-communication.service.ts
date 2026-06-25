import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationKind, Prisma, UserRoleEnum } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthPayload } from '../../auth/auth.types';
import { GeminiService } from '../../ai/gemini.service';
import { swallow } from '../../../common/logging/swallow';
import { NotificationsService } from '../../notifications/notifications.service';

type CommunicationStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'PUBLISHED'
  | 'EXPIRED'
  | 'ARCHIVED'
  | 'CANCELLED'
  | 'REJECTED';

type CommunicationType = 'SIMPLE' | 'BANNER' | 'VIDEO' | 'POLL' | 'SURVEY' | 'CAMPAIGN';
type CommunicationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL' | 'URGENT';

interface AudienceRule {
  scope: 'ALL_COMPANY' | 'AREAS' | 'USERS' | 'MANAGERS' | 'DIRECTORS' | 'ACTIVE_USERS';
  areaIds?: string[];
  userIds?: string[];
  roles?: string[];
  description?: string;
}

interface ChannelConfig {
  platform?: boolean;
  homeCard?: boolean;
  topBanner?: boolean;
  mandatoryPopup?: boolean;
  myDay?: boolean;
  digitalBoard?: boolean;
  corporateTv?: boolean;
  kiosk?: boolean;
  qrCode?: boolean;
  email?: boolean;
  push?: boolean;
}

interface CommunicationPollOption {
  id: string;
  label: string;
}

interface CommunicationPoll {
  question: string;
  type: 'SINGLE' | 'MULTIPLE' | 'SCALE' | 'YES_NO' | 'TEXT' | 'NPS';
  options: CommunicationPollOption[];
  anonymous: boolean;
  allowMultiple: boolean;
  showResults: boolean;
  dueAt?: string | null;
}

interface ReadReceipt {
  userId: string;
  userName: string;
  viewedAt: string;
  confirmedAt?: string | null;
  channel?: string | null;
  device?: string | null;
  ip?: string | null;
  dwellSeconds?: number | null;
}

interface Reaction {
  id: string;
  userId: string;
  userName: string;
  type: 'LIKE' | 'UNDERSTOOD' | 'IMPORTANT' | 'QUESTION';
  createdAt: string;
}

interface Comment {
  id: string;
  userId: string;
  userName: string;
  body: string;
  createdAt: string;
  moderated: boolean;
}

interface PollResponse {
  id: string;
  userId: string;
  userName: string;
  answers: string[];
  text?: string | null;
  createdAt: string;
}

interface CommunicationPost {
  id: string;
  title: string;
  subtitle?: string | null;
  content: string;
  type: CommunicationType;
  category: string;
  priority: CommunicationPriority;
  status: CommunicationStatus;
  authorId: string;
  authorName: string;
  approverId?: string | null;
  approverName?: string | null;
  approvalComment?: string | null;
  audience: AudienceRule;
  channels: ChannelConfig;
  publishAt?: string | null;
  expiresAt?: string | null;
  publishedAt?: string | null;
  archivedAt?: string | null;
  coverImageUrl?: string | null;
  bannerUrl?: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  actionUrl?: string | null;
  actionLabel?: string | null;
  estimatedMinutes?: number | null;
  requiresReadConfirmation: boolean;
  requiresPollAnswer: boolean;
  requiresVideoCompletion: boolean;
  allowComments: boolean;
  allowReactions: boolean;
  isMandatory: boolean;
  isPinned: boolean;
  isFeatured: boolean;
  publicLinkEnabled: boolean;
  qrCodeValue: string;
  campaignId?: string | null;
  linkedModule?: string | null;
  linkedEntityId?: string | null;
  attachments: Array<{ id: string; name: string; url?: string | null; type?: string | null }>;
  poll?: CommunicationPoll | null;
  receipts: ReadReceipt[];
  reactions: Reaction[];
  comments: Comment[];
  pollResponses: PollResponse[];
  version: number;
  history: Array<{ at: string; by: string; action: string; note?: string | null }>;
  createdAt: string;
  updatedAt: string;
}

const POST_INCLUDE = {
  reads: true,
  reactions: true,
  comments: { orderBy: { createdAt: 'asc' as const } },
  pollResponses: true,
};

@Injectable()
export class OrganizationalCommunicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: GeminiService,
    private readonly notifications: NotificationsService,
  ) {}

  async overview(me: AuthPayload) {
    const [dbPosts, users, areas, dbCampaigns, dbMedia, integrations] = await Promise.all([
      this.prisma.communicationPost.findMany({ where: { companyId: me.companyId, deletedAt: null }, include: POST_INCLUDE, orderBy: { createdAt: 'desc' } }),
      this.activeUsers(me.companyId),
      this.prisma.orgNode.findMany({
        where: { companyId: me.companyId, deletedAt: null, active: true },
        select: { id: true, name: true, type: true, parentId: true },
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.communicationCampaign.findMany({ where: { companyId: me.companyId, deletedAt: null }, orderBy: { createdAt: 'desc' } }),
      this.prisma.communicationMedia.findMany({ where: { companyId: me.companyId, deletedAt: null }, orderBy: { createdAt: 'desc' } }),
      this.integrationSignals(me.companyId),
    ]);

    const nameOf = this.nameResolver(users);
    const memPosts = dbPosts.map((p) => this.toMemoryPost(p, nameOf));
    const posts = memPosts.map((post) => this.decoratePost(post, users));
    const visiblePosts = posts.filter((post) => this.isTargetUser(post.audience, me, users));

    const campaigns = dbCampaigns.map((c) => ({
      id: c.id,
      name: c.name,
      objective: c.objective,
      category: c.category,
      status: c.status,
      ownerId: c.ownerId,
      ownerName: nameOf(c.ownerId),
      startsAt: this.iso(c.startsAt),
      endsAt: this.iso(c.endsAt),
      targetAudience: (c.targetAudience as unknown as AudienceRule) ?? null,
      postIds: memPosts.filter((p) => p.campaignId === c.id).map((p) => p.id),
      indicatorIds: (c.indicatorIds as string[]) ?? [],
      actionIds: (c.actionIds as string[]) ?? [],
      createdAt: this.iso(c.createdAt),
    }));
    const media = dbMedia.map((m) => ({
      id: m.id,
      name: m.name,
      type: m.type,
      category: m.category,
      tags: (m.tags as string[]) ?? [],
      url: m.url,
      ownerAreaId: m.ownerAreaId,
      authorName: nameOf(m.authorId),
      version: m.version,
      status: m.status,
      validUntil: this.iso(m.validUntil),
      usageCount: m.usageCount,
      createdAt: this.iso(m.createdAt),
    }));
    const activeCampaigns = campaigns.filter((campaign) => campaign.status === 'ACTIVE');

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const publishedThisMonth = posts.filter((post) => post.publishedAt && new Date(post.publishedAt) >= monthStart).length;
    const totalViews = posts.reduce((sum, post) => sum + post.receipts.length, 0);
    const totalAudience = posts.reduce((sum, post) => sum + post.audienceSize, 0);
    const confirmationsRequired = posts.reduce((sum, post) => sum + (post.requiresReadConfirmation ? post.audienceSize : 0), 0);
    const confirmationsDone = posts.reduce((sum, post) => sum + post.receipts.filter((receipt) => receipt.confirmedAt).length, 0);
    const pollAudience = posts.reduce((sum, post) => sum + (post.poll ? post.audienceSize : 0), 0);
    const pollResponses = posts.reduce((sum, post) => sum + post.pollResponses.length, 0);
    const mandatoryPending = visiblePosts.filter(
      (post) => post.isMandatory && post.status === 'PUBLISHED' && !post.receipts.some((receipt) => receipt.userId === me.sub && receipt.confirmedAt),
    );

    return {
      generatedAt: new Date().toISOString(),
      metrics: {
        publishedThisMonth,
        scheduled: posts.filter((post) => post.status === 'SCHEDULED').length,
        drafts: posts.filter((post) => post.status === 'DRAFT').length,
        pendingApproval: posts.filter((post) => post.status === 'PENDING_APPROVAL').length,
        totalViews,
        readRate: totalAudience ? totalViews / totalAudience : 0,
        confirmationRate: confirmationsRequired ? confirmationsDone / confirmationsRequired : 0,
        pollResponseRate: pollAudience ? pollResponses / pollAudience : 0,
        mandatoryPending: mandatoryPending.length,
        lowReadAudiences: this.lowReadAreas(posts, areas).slice(0, 5),
        areasWithoutEngagement: this.lowReadAreas(posts, areas).filter((area) => area.readRate === 0).length,
        activeCampaigns: activeCampaigns.length,
        expired: posts.filter((post) => post.expiresAt && new Date(post.expiresAt) < now && post.status === 'PUBLISHED').length,
        critical: posts.filter((post) => ['CRITICAL', 'URGENT'].includes(post.priority)).length,
      },
      charts: {
        readByArea: this.readByArea(posts, areas, users),
        engagementByType: this.engagementByType(posts),
        mostAccessed: [...posts].sort((a, b) => b.receipts.length - a.receipts.length).slice(0, 8),
        monthlyEvolution: this.monthlyEvolution(posts),
        pollResponses: posts
          .filter((post) => post.poll)
          .map((post) => ({ id: post.id, title: post.title, responses: post.pollResponses.length, audience: post.audienceSize })),
        pendingByManager: this.pendingByManager(posts, users),
      },
      myWall: {
        mandatoryPending,
        recent: visiblePosts
          .filter((post) => post.status === 'PUBLISHED')
          .sort((a, b) => new Date(b.publishedAt ?? b.createdAt).getTime() - new Date(a.publishedAt ?? a.createdAt).getTime())
          .slice(0, 12),
        campaigns: activeCampaigns,
        polls: visiblePosts.filter((post) => post.poll && post.status === 'PUBLISHED'),
        readHistory: visiblePosts.filter((post) => post.receipts.some((receipt) => receipt.userId === me.sub)),
      },
      team: this.teamSummary(me, posts, users),
      posts,
      campaigns,
      media,
      audienceOptions: {
        users: users.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          defaultNodeId: user.defaultNodeId,
          areaName: user.defaultNode?.name ?? null,
        })),
        areas,
        scopes: ['Toda a empresa', 'Áreas', 'Usuários específicos', 'Gestores', 'Diretoria', 'Usuários ativos'],
      },
      integrationSignals: integrations,
      permissions: {
        canCreate: true,
        canApprove: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'DIRECTOR', 'MANAGER'].includes(me.role),
        canPublish: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'DIRECTOR', 'MANAGER'].includes(me.role),
      },
      ai: { enabled: this.ai.isEnabled, provider: this.ai.provider, model: this.ai.modelName },
    };
  }

  async getPost(me: AuthPayload, id: string) {
    const post = await this.prisma.communicationPost.findFirst({ where: { id, companyId: me.companyId, deletedAt: null }, include: POST_INCLUDE });
    if (!post) throw new NotFoundException('Comunicado não encontrado.');
    const users = await this.activeUsers(me.companyId);
    return this.decoratePost(this.toMemoryPost(post, this.nameResolver(users)), users);
  }

  async createPost(me: AuthPayload, body: Partial<CommunicationPost>) {
    const audience = this.normalizeAudience(body.audience);
    const channels = this.normalizeChannels(body.channels, body.priority as CommunicationPriority);
    const poll = this.normalizePoll(body.poll);
    const priority = (body.priority as CommunicationPriority) || 'NORMAL';
    const type = (body.type as CommunicationType) || 'SIMPLE';
    const expiresAt = this.cleanDate(body.expiresAt);
    this.validatePostRules({
      audience,
      isMandatory: Boolean(body.isMandatory),
      priority,
      expiresAt,
      type,
      requiresVideoCompletion: Boolean(body.requiresVideoCompletion),
      requiresReadConfirmation: Boolean(body.requiresReadConfirmation),
      requiresPollAnswer: Boolean(body.requiresPollAnswer),
      poll,
    });
    const now = new Date().toISOString();
    const created = await this.prisma.communicationPost.create({
      data: {
        companyId: me.companyId,
        title: this.required(body.title, 'Informe o título do comunicado.'),
        subtitle: this.clean(body.subtitle),
        content: this.required(body.content, 'Informe o conteúdo do comunicado.'),
        type,
        category: this.clean(body.category) ?? 'Institucional',
        priority,
        status: (body.status as CommunicationStatus) || 'DRAFT',
        authorId: me.sub,
        audience: audience as unknown as Prisma.InputJsonValue,
        channels: channels as unknown as Prisma.InputJsonValue,
        poll: poll ? (poll as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        attachments: (Array.isArray(body.attachments) ? body.attachments : []) as unknown as Prisma.InputJsonValue,
        history: [{ at: now, by: me.name ?? me.sub, action: 'Criado' }] as unknown as Prisma.InputJsonValue,
        publishAt: this.toDate(body.publishAt),
        expiresAt: this.toDate(body.expiresAt),
        coverImageUrl: this.clean(body.coverImageUrl),
        bannerUrl: this.clean(body.bannerUrl),
        videoUrl: this.clean(body.videoUrl),
        thumbnailUrl: this.clean(body.thumbnailUrl),
        actionUrl: this.clean(body.actionUrl),
        actionLabel: this.clean(body.actionLabel),
        estimatedMinutes: Number(body.estimatedMinutes ?? 0) || null,
        requiresReadConfirmation: Boolean(body.requiresReadConfirmation),
        requiresPollAnswer: Boolean(body.requiresPollAnswer),
        requiresVideoCompletion: Boolean(body.requiresVideoCompletion),
        allowComments: body.allowComments ?? true,
        allowReactions: body.allowReactions ?? true,
        isMandatory: Boolean(body.isMandatory),
        isPinned: Boolean(body.isPinned),
        isFeatured: Boolean(body.isFeatured),
        publicLinkEnabled: Boolean(body.publicLinkEnabled),
        qrCodeValue: `/comunicacao?post=${randomUUID()}`,
        campaignId: this.clean(body.campaignId),
        linkedModule: this.clean(body.linkedModule),
        linkedEntityId: this.clean(body.linkedEntityId),
        version: 1,
      },
      select: { id: true },
    });
    return this.getPost(me, created.id);
  }

  async updatePost(me: AuthPayload, id: string, body: Partial<CommunicationPost>) {
    const post = await this.prisma.communicationPost.findFirst({ where: { id, companyId: me.companyId, deletedAt: null } });
    if (!post) throw new NotFoundException('Comunicado não encontrado.');

    const audience = body.audience ? this.normalizeAudience(body.audience) : (post.audience as unknown as AudienceRule);
    const priority = (body.priority as CommunicationPriority) ?? (post.priority as CommunicationPriority);
    const type = (body.type as CommunicationType) ?? (post.type as CommunicationType);
    const expiresAt = body.expiresAt !== undefined ? this.cleanDate(body.expiresAt) : this.iso(post.expiresAt);
    const poll = body.poll !== undefined ? this.normalizePoll(body.poll) : (post.poll as CommunicationPoll | null);
    this.validatePostRules({
      audience,
      isMandatory: body.isMandatory !== undefined ? Boolean(body.isMandatory) : post.isMandatory,
      priority,
      expiresAt,
      type,
      requiresVideoCompletion: body.requiresVideoCompletion !== undefined ? Boolean(body.requiresVideoCompletion) : post.requiresVideoCompletion,
      requiresReadConfirmation: body.requiresReadConfirmation !== undefined ? Boolean(body.requiresReadConfirmation) : post.requiresReadConfirmation,
      requiresPollAnswer: body.requiresPollAnswer !== undefined ? Boolean(body.requiresPollAnswer) : post.requiresPollAnswer,
      poll,
    });

    const data: Prisma.CommunicationPostUncheckedUpdateInput = { updatedAt: new Date() };
    if (body.title !== undefined) data.title = this.required(body.title, 'Informe o título do comunicado.');
    if (body.subtitle !== undefined) data.subtitle = this.clean(body.subtitle);
    if (body.content !== undefined) data.content = this.required(body.content, 'Informe o conteúdo do comunicado.');
    if (body.type !== undefined) data.type = type;
    if (body.category !== undefined) data.category = this.clean(body.category) ?? post.category;
    if (body.priority !== undefined) data.priority = priority;
    if (body.audience !== undefined) data.audience = audience as unknown as Prisma.InputJsonValue;
    if (body.channels !== undefined) data.channels = this.normalizeChannels(body.channels, priority) as unknown as Prisma.InputJsonValue;
    if (body.poll !== undefined) data.poll = poll ? (poll as unknown as Prisma.InputJsonValue) : Prisma.JsonNull;
    if (body.attachments !== undefined) data.attachments = (Array.isArray(body.attachments) ? body.attachments : []) as unknown as Prisma.InputJsonValue;
    if (body.publishAt !== undefined) data.publishAt = this.toDate(body.publishAt);
    if (body.expiresAt !== undefined) data.expiresAt = this.toDate(body.expiresAt);
    for (const key of ['coverImageUrl', 'bannerUrl', 'videoUrl', 'thumbnailUrl', 'actionUrl', 'actionLabel'] as const) {
      if (body[key] !== undefined) (data as any)[key] = this.clean(body[key]);
    }
    if (body.estimatedMinutes !== undefined) data.estimatedMinutes = Number(body.estimatedMinutes) || null;
    for (const key of ['requiresReadConfirmation', 'requiresPollAnswer', 'requiresVideoCompletion', 'allowComments', 'allowReactions', 'isMandatory', 'isPinned', 'isFeatured', 'publicLinkEnabled'] as const) {
      if (body[key] !== undefined) (data as any)[key] = Boolean(body[key]);
    }
    if (body.campaignId !== undefined) data.campaignId = this.clean(body.campaignId);

    if (post.status === 'PUBLISHED' && body.status === undefined) {
      data.version = { increment: 1 };
      data.history = this.appendHistory(post.history, me, 'Nova versão editada');
    }
    await this.prisma.communicationPost.update({ where: { id }, data });
    return this.getPost(me, id);
  }

  async changeStatus(me: AuthPayload, id: string, body: { status: CommunicationStatus; comment?: string; approverId?: string }) {
    const post = await this.prisma.communicationPost.findFirst({ where: { id, companyId: me.companyId, deletedAt: null }, include: POST_INCLUDE });
    if (!post) throw new NotFoundException('Comunicado não encontrado.');
    const status = body.status;
    if (!status) throw new BadRequestException('Informe o novo status.');
    if (post.status === 'PUBLISHED' && status !== 'ARCHIVED' && status !== 'EXPIRED' && status !== 'CANCELLED') {
      throw new BadRequestException('Comunicado publicado não pode voltar de status. Arquive ou publique uma nova versão.');
    }
    const now = new Date();
    const data: Prisma.CommunicationPostUpdateInput = {
      status,
      approverId: body.approverId ?? post.approverId ?? me.sub,
      approvalComment: this.clean(body.comment),
      updatedAt: now,
      history: this.appendHistory(post.history, me, this.statusLabel(status), body.comment),
    };
    if (status === 'PUBLISHED') data.publishedAt = now;
    if (status === 'ARCHIVED') data.archivedAt = now;
    await this.prisma.communicationPost.update({ where: { id }, data });
    if (status === 'PUBLISHED') {
      await this.notifyAudience(me.companyId, { id: post.id, title: post.title, subtitle: post.subtitle, content: post.content, audience: post.audience as unknown as AudienceRule });
    }
    return this.getPost(me, id);
  }

  async markRead(me: AuthPayload, id: string, body: { confirmed?: boolean; channel?: string; device?: string; dwellSeconds?: number; ip?: string }) {
    await this.assertPost(me, id);
    const now = new Date();
    const dwell = Number(body.dwellSeconds ?? 0) || null;
    await this.prisma.communicationPostRead.upsert({
      where: { postId_userId: { postId: id, userId: me.sub } },
      create: {
        postId: id,
        userId: me.sub,
        viewedAt: now,
        confirmedAt: body.confirmed ? now : null,
        channel: this.clean(body.channel),
        device: this.clean(body.device),
        ip: this.clean(body.ip),
        dwellSeconds: dwell,
      },
      update: {
        confirmedAt: body.confirmed ? now : undefined,
        channel: body.channel !== undefined ? this.clean(body.channel) : undefined,
        device: body.device !== undefined ? this.clean(body.device) : undefined,
        ip: body.ip !== undefined ? this.clean(body.ip) : undefined,
        dwellSeconds: dwell ?? undefined,
      },
    });
    return this.getPost(me, id);
  }

  async react(me: AuthPayload, id: string, body: { type: Reaction['type'] }) {
    const post = await this.assertPost(me, id);
    if (!post.allowReactions) throw new BadRequestException('Este comunicado não permite reações.');
    const type = body.type ?? 'LIKE';
    await this.prisma.communicationPostReaction.upsert({
      where: { postId_userId: { postId: id, userId: me.sub } },
      create: { postId: id, userId: me.sub, type },
      update: { type, createdAt: new Date() },
    });
    return this.getPost(me, id);
  }

  async comment(me: AuthPayload, id: string, body: { body: string }) {
    const post = await this.assertPost(me, id);
    if (!post.allowComments) throw new BadRequestException('Este comunicado não permite comentários.');
    await this.prisma.communicationPostComment.create({
      data: { postId: id, userId: me.sub, body: this.required(body.body, 'Informe o comentário.'), moderated: false },
    });
    return this.getPost(me, id);
  }

  async respondPoll(me: AuthPayload, id: string, body: { answers?: string[]; text?: string }) {
    const post = await this.assertPost(me, id);
    if (!post.poll) throw new NotFoundException('Enquete não encontrada.');
    const answers = (Array.isArray(body.answers) ? body.answers : []) as unknown as Prisma.InputJsonValue;
    await this.prisma.communicationPollResponse.upsert({
      where: { postId_userId: { postId: id, userId: me.sub } },
      create: { postId: id, userId: me.sub, answers, text: this.clean(body.text) },
      update: { answers, text: this.clean(body.text), createdAt: new Date() },
    });
    return this.getPost(me, id);
  }

  async createCampaign(me: AuthPayload, body: any) {
    const created = await this.prisma.communicationCampaign.create({
      data: {
        companyId: me.companyId,
        name: this.required(body.name, 'Informe o nome da campanha.'),
        objective: this.clean(body.objective) ?? 'Comunicar e engajar o público-alvo.',
        category: this.clean(body.category) ?? 'Campanha corporativa',
        status: body.status ?? 'DRAFT',
        ownerId: me.sub,
        startsAt: this.toDate(body.startsAt),
        endsAt: this.toDate(body.endsAt),
        targetAudience: this.normalizeAudience(body.targetAudience) as unknown as Prisma.InputJsonValue,
        indicatorIds: (Array.isArray(body.indicatorIds) ? body.indicatorIds : []) as unknown as Prisma.InputJsonValue,
        actionIds: (Array.isArray(body.actionIds) ? body.actionIds : []) as unknown as Prisma.InputJsonValue,
        createdById: me.sub,
      },
    });
    return created;
  }

  async createMedia(me: AuthPayload, body: any) {
    const created = await this.prisma.communicationMedia.create({
      data: {
        companyId: me.companyId,
        name: this.required(body.name, 'Informe o nome da mídia.'),
        type: body.type ?? 'IMAGE',
        category: this.clean(body.category) ?? 'Geral',
        tags: (Array.isArray(body.tags) ? body.tags : []) as unknown as Prisma.InputJsonValue,
        url: this.clean(body.url),
        ownerAreaId: this.clean(body.ownerAreaId),
        authorId: me.sub,
        version: Number(body.version ?? 1),
        status: body.status ?? 'ACTIVE',
        validUntil: this.toDate(body.validUntil),
      },
    });
    return created;
  }

  async aiDraft(
    me: AuthPayload,
    body: { objective?: string; audience?: string; tone?: string; sourceText?: string; type?: CommunicationType },
  ) {
    const prompt = [
      'Você é assistente de Comunicação Organizacional do Gestão 360.',
      'Crie um comunicado interno em português, simples, objetivo e corporativo.',
      'Retorne JSON com title, subtitle, shortVersion, fullVersion, bannerSummary, suggestedChannels, suggestedAudience e pollQuestions.',
      `Tipo: ${body.type ?? 'SIMPLE'}`,
      `Objetivo: ${body.objective ?? 'Comunicar uma orientação importante.'}`,
      `Público: ${body.audience ?? 'Colaboradores da empresa'}`,
      `Tom: ${body.tone ?? 'claro, acessível e profissional'}`,
      `Texto base: ${body.sourceText ?? '-'}`,
    ].join('\n');
    const generated = await this.ai.generateJson(prompt, { temperature: 0.35, maxOutputTokens: 900 });
    if (generated) return { provider: this.ai.provider, model: this.ai.modelName, draft: generated };
    return {
      provider: 'rules',
      model: null,
      draft: {
        title: body.objective ? `Comunicado: ${body.objective}` : 'Comunicado importante',
        subtitle: 'Informação oficial da empresa',
        shortVersion: 'Leia o comunicado e confirme ciência quando aplicável.',
        fullVersion: body.sourceText || 'Este comunicado reúne orientações importantes para o público-alvo definido.',
        bannerSummary: 'Orientação oficial disponível no Gestão 360.',
        suggestedChannels: ['Portal', 'Meu Dia', 'Notificação interna'],
        suggestedAudience: body.audience || 'Toda a empresa',
        pollQuestions: ['Você entendeu a orientação?', 'Precisa de apoio do gestor?'],
      },
    };
  }

  // =========================================================================
  // Data-access helpers
  // =========================================================================

  private async assertPost(me: AuthPayload, id: string) {
    const post = await this.prisma.communicationPost.findFirst({
      where: { id, companyId: me.companyId, deletedAt: null },
      select: { id: true, allowReactions: true, allowComments: true, poll: true },
    });
    if (!post) throw new NotFoundException('Comunicado não encontrado.');
    return post;
  }

  private nameResolver(users: any[]) {
    const map = new Map(users.map((u) => [u.id, u.name as string]));
    return (id: string | null | undefined) => (id ? map.get(id) ?? 'Usuário' : 'Usuário');
  }

  private iso(value: Date | null | undefined): string | null {
    return value ? new Date(value).toISOString() : null;
  }

  private toMemoryPost(p: any, nameOf: (id: string | null | undefined) => string): CommunicationPost {
    return {
      id: p.id,
      title: p.title,
      subtitle: p.subtitle,
      content: p.content,
      type: p.type,
      category: p.category,
      priority: p.priority,
      status: p.status,
      authorId: p.authorId,
      authorName: nameOf(p.authorId),
      approverId: p.approverId,
      approverName: p.approverId ? nameOf(p.approverId) : null,
      approvalComment: p.approvalComment,
      audience: (p.audience as unknown as AudienceRule) ?? { scope: 'ALL_COMPANY' },
      channels: (p.channels as unknown as ChannelConfig) ?? {},
      publishAt: this.iso(p.publishAt),
      expiresAt: this.iso(p.expiresAt),
      publishedAt: this.iso(p.publishedAt),
      archivedAt: this.iso(p.archivedAt),
      coverImageUrl: p.coverImageUrl,
      bannerUrl: p.bannerUrl,
      videoUrl: p.videoUrl,
      thumbnailUrl: p.thumbnailUrl,
      actionUrl: p.actionUrl,
      actionLabel: p.actionLabel,
      estimatedMinutes: p.estimatedMinutes,
      requiresReadConfirmation: p.requiresReadConfirmation,
      requiresPollAnswer: p.requiresPollAnswer,
      requiresVideoCompletion: p.requiresVideoCompletion,
      allowComments: p.allowComments,
      allowReactions: p.allowReactions,
      isMandatory: p.isMandatory,
      isPinned: p.isPinned,
      isFeatured: p.isFeatured,
      publicLinkEnabled: p.publicLinkEnabled,
      qrCodeValue: p.qrCodeValue ?? '',
      campaignId: p.campaignId,
      linkedModule: p.linkedModule,
      linkedEntityId: p.linkedEntityId,
      attachments: Array.isArray(p.attachments) ? p.attachments : [],
      poll: (p.poll as CommunicationPoll | null) ?? null,
      receipts: (p.reads ?? []).map((r: any) => ({
        userId: r.userId,
        userName: nameOf(r.userId),
        viewedAt: this.iso(r.viewedAt) ?? new Date().toISOString(),
        confirmedAt: this.iso(r.confirmedAt),
        channel: r.channel,
        device: r.device,
        ip: r.ip,
        dwellSeconds: r.dwellSeconds,
      })),
      reactions: (p.reactions ?? []).map((r: any) => ({ id: r.id, userId: r.userId, userName: nameOf(r.userId), type: r.type, createdAt: this.iso(r.createdAt)! })),
      comments: (p.comments ?? []).map((c: any) => ({ id: c.id, userId: c.userId, userName: nameOf(c.userId), body: c.body, createdAt: this.iso(c.createdAt)!, moderated: c.moderated })),
      pollResponses: (p.pollResponses ?? []).map((r: any) => ({ id: r.id, userId: r.userId, userName: nameOf(r.userId), answers: Array.isArray(r.answers) ? r.answers : [], text: r.text, createdAt: this.iso(r.createdAt)! })),
      version: p.version,
      history: Array.isArray(p.history) ? p.history : [],
      createdAt: this.iso(p.createdAt)!,
      updatedAt: this.iso(p.updatedAt)!,
    };
  }

  private appendHistory(history: unknown, me: AuthPayload, action: string, note?: string | null) {
    const list = Array.isArray(history) ? history : [];
    return [...list, { at: new Date().toISOString(), by: me.name ?? me.sub, action, note: note ?? null }] as unknown as Prisma.InputJsonValue;
  }

  private decoratePost(post: CommunicationPost, users: any[]) {
    const audienceUsers = users.filter((user) => this.matchesAudience(user, post.audience));
    const audienceSize = audienceUsers.length;
    const confirmations = post.receipts.filter((receipt) => receipt.confirmedAt).length;
    const views = post.receipts.length;
    return {
      ...post,
      audienceSize,
      pendingReads: Math.max(0, audienceSize - views),
      pendingConfirmations: post.requiresReadConfirmation ? Math.max(0, audienceSize - confirmations) : 0,
      readRate: audienceSize ? views / audienceSize : 0,
      confirmationRate: audienceSize && post.requiresReadConfirmation ? confirmations / audienceSize : 0,
      responseRate: audienceSize && post.poll ? post.pollResponses.length / audienceSize : 0,
      reactionSummary: this.reactionSummary(post.reactions),
      pollSummary: this.pollSummary(post),
    };
  }

  private async notifyAudience(companyId: string, post: { id: string; title: string; subtitle?: string | null; content: string; audience: AudienceRule }) {
    const users = await this.activeUsers(companyId);
    const audience = users.filter((user) => this.matchesAudience(user, post.audience)).slice(0, 250);
    await Promise.all(
      audience.map((user) =>
        this.notifications
          .create(companyId, user.id, NotificationKind.MESSAGE, post.title, post.subtitle ?? post.content.slice(0, 140), `/comunicacao?post=${post.id}`)
          .catch(swallow(undefined, 'orgCommunication.notifyAudience', 'debug')),
      ),
    );
  }

  private activeUsers(companyId: string) {
    return this.prisma.user.findMany({
      where: { companyId, deletedAt: null, active: true },
      select: { id: true, name: true, email: true, role: true, defaultNodeId: true, defaultNode: { select: { id: true, name: true, parentId: true } } },
      orderBy: { name: 'asc' },
    });
  }

  private async integrationSignals(companyId: string) {
    const [redIndicators, overdueActions, docsNeedingRead, upcomingMeetings] = await Promise.all([
      this.prisma.indicatorResult.count({ where: { light: 'RED', indicator: { companyId, deletedAt: null } } }),
      this.prisma.actionPlan.count({
        where: { companyId, deletedAt: null, dueDate: { lt: new Date() }, status: { notIn: ['DONE', 'DONE_LATE', 'CANCELLED'] } },
      }),
      this.prisma.documentReadConfirmation.count({ where: { document: { companyId, deletedAt: null }, confirmedAt: null } }).catch(() => 0),
      this.prisma.meeting.count({ where: { companyId, deletedAt: null, startsAt: { gte: new Date() } } }),
    ]);
    return {
      redIndicators,
      overdueActions,
      docsNeedingRead,
      upcomingMeetings,
      suggestions: [
        redIndicators > 0 ? 'Indicadores fora da meta podem gerar comunicados preventivos por área.' : null,
        overdueActions > 0 ? 'Ações atrasadas podem virar alertas segmentados para responsáveis e gestores.' : null,
        docsNeedingRead > 0 ? 'Documentos pendentes podem ser divulgados como comunicado obrigatório.' : null,
        upcomingMeetings > 0 ? 'Reuniões futuras podem publicar pauta e convocação automaticamente.' : null,
      ].filter(Boolean),
    };
  }

  private normalizeAudience(input: any): AudienceRule {
    const audience = input ?? {};
    const scope = audience.scope ?? 'ALL_COMPANY';
    return {
      scope,
      areaIds: Array.isArray(audience.areaIds) ? audience.areaIds.filter(Boolean) : [],
      userIds: Array.isArray(audience.userIds) ? audience.userIds.filter(Boolean) : [],
      roles: Array.isArray(audience.roles) ? audience.roles.filter(Boolean) : [],
      description: this.clean(audience.description) ?? this.audienceLabel(scope),
    };
  }

  private normalizeChannels(input: any, priority?: CommunicationPriority): ChannelConfig {
    const channels = input ?? {};
    const urgent = priority === 'URGENT' || priority === 'CRITICAL';
    return {
      platform: channels.platform ?? true,
      homeCard: channels.homeCard ?? urgent,
      topBanner: channels.topBanner ?? urgent,
      mandatoryPopup: channels.mandatoryPopup ?? urgent,
      myDay: channels.myDay ?? true,
      digitalBoard: channels.digitalBoard ?? false,
      corporateTv: channels.corporateTv ?? false,
      kiosk: channels.kiosk ?? false,
      qrCode: channels.qrCode ?? true,
      email: channels.email ?? urgent,
      push: channels.push ?? urgent,
    };
  }

  private normalizePoll(input: any): CommunicationPoll | null {
    if (!input?.question) return null;
    return {
      question: String(input.question).trim(),
      type: input.type ?? 'SINGLE',
      options: Array.isArray(input.options)
        ? input.options
            .map((option: any) => ({ id: option.id ?? randomUUID(), label: typeof option === 'string' ? option : String(option.label ?? '').trim() }))
            .filter((option: CommunicationPollOption) => option.label)
        : [],
      anonymous: Boolean(input.anonymous),
      allowMultiple: Boolean(input.allowMultiple),
      showResults: input.showResults ?? true,
      dueAt: this.cleanDate(input.dueAt),
    };
  }

  private validatePostRules(post: {
    audience: AudienceRule;
    isMandatory: boolean;
    priority: CommunicationPriority;
    expiresAt: string | null;
    type: CommunicationType;
    requiresVideoCompletion: boolean;
    requiresReadConfirmation: boolean;
    requiresPollAnswer: boolean;
    poll: CommunicationPoll | null;
  }) {
    const audienceDefined =
      post.audience.scope === 'ALL_COMPANY' ||
      post.audience.scope === 'ACTIVE_USERS' ||
      post.audience.scope === 'MANAGERS' ||
      post.audience.scope === 'DIRECTORS' ||
      Boolean(post.audience.areaIds?.length) ||
      Boolean(post.audience.userIds?.length) ||
      Boolean(post.audience.roles?.length);
    if (post.isMandatory && !audienceDefined) throw new BadRequestException('Comunicado obrigatório precisa ter público definido.');
    if ((post.priority === 'CRITICAL' || post.priority === 'URGENT') && !post.expiresAt) {
      throw new BadRequestException('Comunicado crítico ou urgente precisa ter data de validade.');
    }
    if (post.type === 'VIDEO' && post.requiresVideoCompletion && !post.requiresReadConfirmation) {
      throw new BadRequestException('Vídeo obrigatório precisa exigir confirmação de ciência.');
    }
    if ((post.type === 'POLL' || post.type === 'SURVEY' || post.requiresPollAnswer) && !post.poll?.dueAt) {
      throw new BadRequestException('Enquete ou pesquisa precisa ter prazo.');
    }
  }

  private matchesAudience(user: any, audience: AudienceRule) {
    if (audience.scope === 'ALL_COMPANY' || audience.scope === 'ACTIVE_USERS') return true;
    if (audience.scope === 'USERS') return Boolean(audience.userIds?.includes(user.id));
    if (audience.scope === 'AREAS') return Boolean(user.defaultNodeId && audience.areaIds?.includes(user.defaultNodeId));
    if (audience.scope === 'MANAGERS') return user.role === UserRoleEnum.MANAGER;
    if (audience.scope === 'DIRECTORS') return user.role === UserRoleEnum.DIRECTOR;
    return true;
  }

  private isTargetUser(audience: AudienceRule, me: AuthPayload, users: any[]) {
    const user = users.find((item) => item.id === me.sub);
    if (!user) return true;
    return this.matchesAudience(user, audience);
  }

  private readByArea(posts: Array<CommunicationPost & { audienceSize?: number }>, areas: any[], users: any[]) {
    return areas
      .map((area) => {
        const members = users.filter((user) => user.defaultNodeId === area.id);
        if (!members.length) return null;
        const memberIds = new Set(members.map((user) => user.id));
        const delivered = posts.filter((post) => members.some((user) => this.matchesAudience(user, post.audience))).length * members.length;
        const read = posts.reduce((sum, post) => sum + post.receipts.filter((receipt) => memberIds.has(receipt.userId)).length, 0);
        return { areaId: area.id, area: area.name, delivered, read, readRate: delivered ? read / delivered : 0 };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.readRate - a.readRate);
  }

  private lowReadAreas(posts: Array<CommunicationPost & { audienceSize?: number }>, areas: any[]) {
    return areas
      .map((area) => {
        const related = posts.filter((post) => post.audience.scope === 'AREAS' && post.audience.areaIds?.includes(area.id));
        const delivered = related.reduce((sum, post) => sum + (post.audienceSize ?? 0), 0);
        const read = related.reduce((sum, post) => sum + post.receipts.length, 0);
        return { areaId: area.id, area: area.name, delivered, read, readRate: delivered ? read / delivered : 0 };
      })
      .filter((area) => area.delivered > 0)
      .sort((a, b) => a.readRate - b.readRate);
  }

  private engagementByType(posts: CommunicationPost[]) {
    const map = new Map<string, { type: string; posts: number; views: number; confirmations: number; responses: number }>();
    for (const post of posts) {
      const item = map.get(post.type) ?? { type: post.type, posts: 0, views: 0, confirmations: 0, responses: 0 };
      item.posts += 1;
      item.views += post.receipts.length;
      item.confirmations += post.receipts.filter((receipt) => receipt.confirmedAt).length;
      item.responses += post.pollResponses.length;
      map.set(post.type, item);
    }
    return Array.from(map.values());
  }

  private monthlyEvolution(posts: CommunicationPost[]) {
    const map = new Map<string, { month: string; published: number; views: number; confirmations: number }>();
    for (const post of posts) {
      const date = post.publishedAt ?? post.createdAt;
      const month = date.slice(0, 7);
      const item = map.get(month) ?? { month, published: 0, views: 0, confirmations: 0 };
      if (post.status === 'PUBLISHED') item.published += 1;
      item.views += post.receipts.length;
      item.confirmations += post.receipts.filter((receipt) => receipt.confirmedAt).length;
      map.set(month, item);
    }
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month)).slice(-12);
  }

  private pendingByManager(posts: Array<CommunicationPost & { audienceSize?: number }>, users: any[]) {
    const managers = users.filter((user) => user.role === UserRoleEnum.MANAGER);
    return managers.slice(0, 20).map((manager) => {
      const team = users.filter((user) => user.defaultNodeId && user.defaultNodeId === manager.defaultNodeId);
      const teamIds = new Set(team.map((user) => user.id));
      const pending = posts.reduce((sum, post) => {
        const delivered = team.filter((user) => this.matchesAudience(user, post.audience)).length;
        const read = post.receipts.filter((receipt) => teamIds.has(receipt.userId)).length;
        return sum + Math.max(0, delivered - read);
      }, 0);
      return { managerId: manager.id, manager: manager.name, area: manager.defaultNode?.name ?? '-', pending };
    });
  }

  private teamSummary(me: AuthPayload, posts: Array<CommunicationPost & { audienceSize?: number }>, users: any[]) {
    const meUser = users.find((user) => user.id === me.sub);
    const team = meUser?.defaultNodeId ? users.filter((user) => user.defaultNodeId === meUser.defaultNodeId) : [];
    const teamIds = new Set(team.map((user) => user.id));
    return {
      area: meUser?.defaultNode?.name ?? null,
      received: posts.filter((post) => team.some((user) => this.matchesAudience(user, post.audience))).length,
      read: posts.reduce((sum, post) => sum + post.receipts.filter((receipt) => teamIds.has(receipt.userId)).length, 0),
      confirmed: posts.reduce((sum, post) => sum + post.receipts.filter((receipt) => teamIds.has(receipt.userId) && receipt.confirmedAt).length, 0),
      pendingPeople: team.map((user) => ({
        id: user.id,
        name: user.name,
        pending: posts.filter((post) => this.matchesAudience(user, post.audience) && !post.receipts.some((receipt) => receipt.userId === user.id)).length,
      })),
    };
  }

  private reactionSummary(reactions: Reaction[]) {
    return reactions.reduce((acc, reaction) => {
      acc[reaction.type] = (acc[reaction.type] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private pollSummary(post: CommunicationPost) {
    if (!post.poll) return null;
    const counts = new Map<string, number>();
    for (const response of post.pollResponses) {
      for (const answer of response.answers) counts.set(answer, (counts.get(answer) ?? 0) + 1);
    }
    return post.poll.options.map((option) => ({ ...option, votes: counts.get(option.id) ?? 0 }));
  }

  private statusLabel(status: CommunicationStatus) {
    const labels: Record<CommunicationStatus, string> = {
      DRAFT: 'Rascunho',
      PENDING_APPROVAL: 'Enviado para aprovação',
      APPROVED: 'Aprovado',
      SCHEDULED: 'Agendado',
      PUBLISHED: 'Publicado',
      EXPIRED: 'Expirado',
      ARCHIVED: 'Arquivado',
      CANCELLED: 'Cancelado',
      REJECTED: 'Reprovado',
    };
    return labels[status] ?? status;
  }

  private audienceLabel(scope: string) {
    const labels: Record<string, string> = {
      ALL_COMPANY: 'Toda a empresa',
      AREAS: 'Áreas selecionadas',
      USERS: 'Usuários específicos',
      MANAGERS: 'Gestores',
      DIRECTORS: 'Diretoria',
      ACTIVE_USERS: 'Usuários ativos da plataforma',
    };
    return labels[scope] ?? 'Público segmentado';
  }

  private clean(value: unknown) {
    const text = String(value ?? '').trim();
    return text || null;
  }

  private cleanDate(value: unknown) {
    const text = this.clean(value);
    if (!text) return null;
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Data inválida.');
    return date.toISOString();
  }

  private toDate(value: unknown): Date | null {
    const iso = this.cleanDate(value);
    return iso ? new Date(iso) : null;
  }

  private required(value: unknown, message: string) {
    const text = this.clean(value);
    if (!text) throw new BadRequestException(message);
    return text;
  }
}
