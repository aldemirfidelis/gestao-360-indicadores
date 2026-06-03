import { Injectable, NotFoundException } from '@nestjs/common';
import { PresenceStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { PresenceService } from '../presence/presence.service';
import { UpdatePreferencesDto, UpdateProfileDto } from './profile.dto';

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presence: PresenceService,
  ) {}

  /** Perfil corporativo de um usuário (visível dentro da mesma empresa). */
  async getProfile(viewerCompanyId: string, isSuperAdmin: boolean, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null, ...(isSuperAdmin ? {} : { companyId: viewerCompanyId }) },
      select: {
        id: true,
        name: true,
        email: true,
        jobTitle: true,
        phone: true,
        avatarUrl: true,
        bio: true,
        customStatus: true,
        role: true,
        status: true,
        active: true,
        lastLoginAt: true,
        createdAt: true,
        company: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        defaultNode: {
          select: {
            id: true,
            name: true,
            type: true,
            parent: { select: { id: true, name: true, type: true } },
          },
        },
        accessProfile: { select: { id: true, name: true } },
        presence: { select: { status: true, lastSeenAt: true } },
      },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const liveStatus = this.presence.status(user.id);
    const status =
      liveStatus !== PresenceStatus.OFFLINE ? liveStatus : user.presence?.status ?? PresenceStatus.OFFLINE;
    const { presence, ...rest } = user;
    return { ...rest, presence: { status, lastSeenAt: presence?.lastSeenAt ?? null } };
  }

  /** Edita apenas os campos do próprio perfil que o usuário pode alterar. */
  async updateMyProfile(userId: string, dto: UpdateProfileDto) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.bio !== undefined ? { bio: dto.bio || null } : {}),
        ...(dto.customStatus !== undefined ? { customStatus: dto.customStatus || null } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone || null } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl || null } : {}),
      },
    });
    return { ok: true };
  }

  /** Define o status de presença manual e propaga via WebSocket. */
  async setMyStatus(userId: string, status: PresenceStatus) {
    await this.presence.setManualStatus(userId, status === PresenceStatus.OFFLINE ? null : status);
    return { status: this.presence.status(userId) };
  }

  async getPreferences(userId: string) {
    const pref = await this.prisma.notificationPreference.findUnique({ where: { userId } });
    return (
      pref ?? {
        userId,
        browserPush: false,
        emailDigest: false,
        muteMessages: false,
        quietHoursStart: null,
        quietHoursEnd: null,
      }
    );
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: { ...dto },
    });
  }
}
