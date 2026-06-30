import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthPayload } from '../auth/auth.types';
import { resolveSmtpConfig, smtpFrom, buildTransport } from '../../common/smtp';

@Injectable()
export class SupportTicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(me: AuthPayload, body: {
    title: string;
    description: string;
    type: string;
    priority: string;
    module?: string;
    attachments?: Array<{ fileName: string; fileUrl: string; fileType: string; fileSize: number }>;
  }) {
    const user = await this.prisma.user.findUnique({
      where: { id: me.sub },
      include: { company: true },
    });

    if (!user) {
      throw new NotFoundException('Usuário solicitante não encontrado.');
    }

    const ticket = await this.prisma.supportTicket.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        requesterName: user.name,
        requesterEmail: user.email,
        title: body.title,
        description: body.description,
        type: body.type,
        priority: body.priority,
        module: body.module || null,
        status: 'Aberto',
        attachments: body.attachments ? {
          create: body.attachments.map(att => ({
            fileName: att.fileName,
            fileUrl: att.fileUrl,
            fileType: att.fileType,
            fileSize: att.fileSize,
            uploadedByUserId: user.id,
          }))
        } : undefined,
      },
      include: {
        company: true,
        attachments: true,
      }
    });

    // Dispara a notificação de e-mail SEM bloquear a resposta: SMTP lento/indisponível
    // travava a requisição até o timeout do gateway, retornando 502. O chamado já foi
    // criado; a notificação é best-effort em background.
    void this.sendEmailNotification(ticket).catch((err) => {
      console.error('Falha ao notificar chamado por e-mail:', err?.message ?? err);
    });

    return ticket;
  }

  async list(me: AuthPayload, filters: { q?: string; status?: string; priority?: string; type?: string; companyId?: string }) {
    const where: any = {};

    // 1. Controle de acesso por permissão/role
    if (me.role === UserRoleEnum.SUPER_ADMIN) {
      // Super admin vê tudo, podendo filtrar por qualquer empresa
      if (filters.companyId) {
        where.companyId = filters.companyId;
      }
    } else if (
      me.role === UserRoleEnum.COMPANY_ADMIN ||
      me.role === UserRoleEnum.DIRECTOR ||
      me.role === UserRoleEnum.MANAGER
    ) {
      // Gestores veem todos os chamados da empresa dele
      where.companyId = me.companyId;
    } else {
      // Usuário comum vê apenas seus próprios chamados
      where.companyId = me.companyId;
      where.userId = me.sub;
    }

    // 2. Filtros de query
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.priority) {
      where.priority = filters.priority;
    }
    if (filters.type) {
      where.type = filters.type;
    }
    if (filters.q) {
      where.OR = [
        { title: { contains: filters.q, mode: 'insensitive' } },
        { description: { contains: filters.q, mode: 'insensitive' } },
      ];
    }

    return this.prisma.supportTicket.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        company: { select: { id: true, name: true } },
        assignedToUser: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string, me: AuthPayload) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        company: { select: { id: true, name: true } },
        assignedToUser: { select: { id: true, name: true } },
        attachments: true,
        messages: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'asc' },
        }
      }
    });

    if (!ticket) {
      throw new NotFoundException('Chamado não encontrado.');
    }

    // Validar se o usuário tem permissão para visualizar o chamado
    const isSuperAdmin = me.role === UserRoleEnum.SUPER_ADMIN;
    const isGestor = me.role === UserRoleEnum.COMPANY_ADMIN || me.role === UserRoleEnum.DIRECTOR || me.role === UserRoleEnum.MANAGER;
    
    if (!isSuperAdmin) {
      if (ticket.companyId !== me.companyId) {
        throw new ForbiddenException('Você não tem acesso aos dados deste chamado.');
      }
      if (!isGestor && ticket.userId !== me.sub) {
        throw new ForbiddenException('Você não tem acesso a este chamado.');
      }
    }

    // Filtrar mensagens internas se o usuário não for analista/super admin
    if (!isSuperAdmin && ticket.messages) {
      ticket.messages = ticket.messages.filter(msg => !msg.isInternal);
    }

    return ticket;
  }

  async addMessage(id: string, me: AuthPayload, body: { message: string; isInternal?: boolean }) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) {
      throw new NotFoundException('Chamado não encontrado.');
    }

    const isSuperAdmin = me.role === UserRoleEnum.SUPER_ADMIN;
    const isGestor = me.role === UserRoleEnum.COMPANY_ADMIN || me.role === UserRoleEnum.DIRECTOR || me.role === UserRoleEnum.MANAGER;

    if (!isSuperAdmin) {
      if (ticket.companyId !== me.companyId) {
        throw new ForbiddenException('Você não tem permissão para responder a este chamado.');
      }
      if (!isGestor && ticket.userId !== me.sub) {
        throw new ForbiddenException('Você não tem permissão para responder a este chamado.');
      }
      if (body.isInternal) {
        throw new ForbiddenException('Apenas administradores de suporte podem adicionar comentários internos.');
      }
    }

    return this.prisma.supportTicketMessage.create({
      data: {
        ticketId: id,
        userId: me.sub,
        message: body.message,
        isInternal: isSuperAdmin ? (body.isInternal ?? false) : false,
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } }
      }
    });
  }

  async updateTicket(id: string, me: AuthPayload, body: { status?: string; priority?: string; assignedToUserId?: string }) {
    // Apenas Super Admins (administradores do portal) podem alterar configurações do ticket
    if (me.role !== UserRoleEnum.SUPER_ADMIN) {
      throw new ForbiddenException('Apenas analistas de suporte podem alterar configurações de chamados.');
    }

    const ticket = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) {
      throw new NotFoundException('Chamado não encontrado.');
    }

    const updateData: any = {};
    if (body.status) {
      updateData.status = body.status;
      if (body.status === 'Resolvido' || body.status === 'Encerrado' || body.status === 'Cancelado') {
        updateData.closedAt = new Date();
      } else {
        updateData.closedAt = null;
      }
    }
    if (body.priority) {
      updateData.priority = body.priority;
    }
    if (body.assignedToUserId !== undefined) {
      updateData.assignedToUserId = body.assignedToUserId;
    }

    return this.prisma.supportTicket.update({
      where: { id },
      data: updateData,
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        company: { select: { id: true, name: true } },
        assignedToUser: { select: { id: true, name: true } },
      }
    });
  }

  private async sendEmailNotification(ticket: any) {
    const recipient = 'suporte@gestao360.org';
    const subject = `[Chamado #${ticket.id.substring(0, 8)}] Novo chamado: ${ticket.title}`;

    const portalUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://gestao360.org';
    const ticketLink = `${portalUrl}/central-atendimento/detalhes/${ticket.id}`;

    const body = `
Olá, Equipe de Suporte do Gestão 360.

Um novo chamado de atendimento foi aberto no portal:

- NÚMERO DO CHAMADO: ${ticket.id}
- CLIENTE (EMPRESA): ${ticket.company?.name || 'Não informada'}
- SOLICITANTE: ${ticket.requesterName} (${ticket.requesterEmail})
- DATA DE ABERTURA: ${ticket.createdAt.toLocaleString('pt-BR')}
- TIPO DE SOLICITAÇÃO: ${ticket.type}
- PRIORIDADE: ${ticket.priority}
- MÓDULO RELACIONADO: ${ticket.module || 'Geral'}

---------------------------------------------------------
TÍTULO:
${ticket.title}

DESCRIÇÃO:
${ticket.description}
---------------------------------------------------------

Você pode acessar o chamado completo para atendimento no link abaixo:
${ticketLink}

Atenciosamente,
Plataforma Gestão 360
    `.trim();

    try {
      const cfg = await resolveSmtpConfig(this.prisma);
      const from = cfg ? smtpFrom(cfg) : undefined;
      
      if (!cfg?.host || !from) {
        console.warn('NOTIFICAÇÃO DE SUPORTE: SMTP não configurado. Exibindo payload do chamado:', {
          to: recipient,
          subject,
          body,
        });
        return;
      }

      const transporter = buildTransport(cfg);
      await transporter.sendMail({
        from,
        to: recipient,
        replyTo: ticket.requesterEmail,
        subject,
        text: body,
        html: body.replace(/\n/g, '<br />'),
      });
      
      console.info(`NOTIFICAÇÃO DE SUPORTE: E-mail enviado com sucesso para ${recipient} referente ao chamado ${ticket.id}`);
    } catch (err: any) {
      console.error(`NOTIFICAÇÃO DE SUPORTE: Erro ao enviar e-mail de notificação para ${recipient}:`, err?.message ?? err);
    }
  }
}
