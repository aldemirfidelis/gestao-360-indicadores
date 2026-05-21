import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.company.findMany({
      where: { deletedAt: null },
      include: { branches: true },
    });
  }

  getById(id: string) {
    return this.prisma.company.findUnique({
      where: { id },
      include: { branches: true },
    });
  }

  listBranches(companyId: string) {
    return this.prisma.branch.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }
}
