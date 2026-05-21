import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { UserCreateInput } from '@g360/shared';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string) {
    return this.prisma.user.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        jobTitle: true,
        avatarUrl: true,
        active: true,
        lastLoginAt: true,
        defaultNode: { select: { id: true, name: true } },
      },
    });
  }

  async getById(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { defaultNode: true },
    });
    if (!user) throw new NotFoundException('Usuario nao encontrado');
    return user;
  }

  async create(input: UserCreateInput) {
    const exists = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (exists) throw new ConflictException('Email ja cadastrado');
    const rounds = parseInt(process.env.BCRYPT_ROUNDS ?? '10', 10);
    const hash = await bcrypt.hash(input.password, rounds);
    return this.prisma.user.create({
      data: {
        companyId: input.companyId,
        email: input.email.toLowerCase(),
        name: input.name,
        passwordHash: hash,
        role: input.role,
        jobTitle: input.jobTitle ?? null,
        phone: input.phone ?? null,
        defaultNodeId: input.defaultNodeId ?? null,
      },
    });
  }

  async setActive(id: string, active: boolean) {
    return this.prisma.user.update({ where: { id }, data: { active } });
  }

  async remove(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    });
  }
}
