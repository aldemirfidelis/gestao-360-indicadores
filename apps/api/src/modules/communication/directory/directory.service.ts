import { Injectable } from '@nestjs/common';
import { Prisma, PresenceStatus, UserAccessStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { PresenceService } from '../presence/presence.service';

export interface DirectoryFilters {
  q?: string;
  branchId?: string;
  orgNodeId?: string;
  role?: string;
  status?: string;
  cursor?: string;
  limit?: number;
}

const DIRECTORY_SELECT = {
  id: true,
  name: true,
  email: true,
  jobTitle: true,
  avatarUrl: true,
  bio: true,
  customStatus: true,
  role: true,
  status: true,
  active: true,
  lastLoginAt: true,
  branch: { select: { id: true, name: true } },
  defaultNode: { select: { id: true, name: true, type: true } },
  company: { select: { id: true, name: true } },
  presence: { select: { status: true, lastSeenAt: true } },
} satisfies Prisma.UserSelect;

@Injectable()
export class DirectoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presence: PresenceService,
  ) {}

  /** Lista paginada por cursor de todos os usuários ativos da empresa. */
  async list(companyId: string, filters: DirectoryFilters) {
    const take = Math.min(Math.max(filters.limit ?? 30, 1), 100);

    const where: Prisma.UserWhereInput = {
      companyId,
      deletedAt: null,
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
      ...(filters.orgNodeId ? { defaultNodeId: filters.orgNodeId } : {}),
      ...(filters.role ? { role: filters.role as Prisma.UserWhereInput['role'] } : {}),
      ...(filters.status
        ? { status: filters.status as UserAccessStatus }
        : { status: UserAccessStatus.ACTIVE }),
      ...(filters.q
        ? {
            OR: [
              { name: { contains: filters.q, mode: 'insensitive' } },
              { email: { contains: filters.q, mode: 'insensitive' } },
              { jobTitle: { contains: filters.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.user.findMany({
      where,
      select: DIRECTORY_SELECT,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: take + 1,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;
    const live = this.presence.snapshotFor(page.map((u) => u.id));

    return {
      items: page.map((u) => this.decorate(u, live)),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  /** Usuários online agora (estado vivo em memória). */
  async online(companyId: string, q?: string) {
    const ids = this.presence.onlineUserIds();
    if (ids.length === 0) return { count: 0, items: [] };

    const rows = await this.prisma.user.findMany({
      where: {
        id: { in: ids },
        companyId,
        deletedAt: null,
        status: UserAccessStatus.ACTIVE,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: DIRECTORY_SELECT,
      orderBy: [{ name: 'asc' }],
    });

    const live = this.presence.snapshotFor(rows.map((u) => u.id));
    return { count: rows.length, items: rows.map((u) => this.decorate(u, live)) };
  }

  private decorate(
    u: Prisma.UserGetPayload<{ select: typeof DIRECTORY_SELECT }>,
    live: Record<string, { status: PresenceStatus; lastSeenAt: Date | null }>,
  ) {
    const liveStatus = live[u.id]?.status;
    const status: PresenceStatus =
      liveStatus && liveStatus !== PresenceStatus.OFFLINE
        ? liveStatus
        : u.presence?.status ?? PresenceStatus.OFFLINE;
    const { presence, ...rest } = u;
    return {
      ...rest,
      presence: {
        status,
        lastSeenAt: presence?.lastSeenAt ?? null,
      },
    };
  }
}
