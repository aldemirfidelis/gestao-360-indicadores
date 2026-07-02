import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformAdminService } from '../src/modules/platform-admin/services/platform-admin.service';

const smtpMocks = vi.hoisted(() => ({
  sendMail: vi.fn(),
  resolveSmtpConfig: vi.fn(),
  buildTransport: vi.fn(),
  smtpFrom: vi.fn(),
}));

vi.mock('../src/common/smtp', () => ({
  resolveSmtpConfig: smtpMocks.resolveSmtpConfig,
  buildTransport: smtpMocks.buildTransport,
  smtpFrom: smtpMocks.smtpFrom,
}));

const ticket = {
  id: 'ticket-12345678',
  requesterName: 'Pessoa Teste',
  requesterEmail: 'pessoa@example.com',
};

function serviceFor(isInternal: boolean) {
  const prisma = {
    supportTicket: {
      findUnique: vi.fn().mockResolvedValue(ticket),
    },
    supportTicketMessage: {
      create: vi.fn().mockResolvedValue({
        id: 'message-1',
        ticketId: ticket.id,
        message: 'Resposta de teste',
        isInternal,
      }),
    },
  };

  return {
    prisma,
    service: new PlatformAdminService(prisma as never, {} as never),
  };
}

describe('PlatformAdminService inbox support replies', () => {
  beforeEach(() => {
    smtpMocks.sendMail.mockReset().mockResolvedValue({ messageId: 'test' });
    smtpMocks.resolveSmtpConfig.mockReset().mockResolvedValue({
      host: 'smtp.example.com',
      fromAddress: 'contato@gestao360.org',
    });
    smtpMocks.buildTransport.mockReset().mockReturnValue({ sendMail: smtpMocks.sendMail });
    smtpMocks.smtpFrom.mockReset().mockReturnValue('Gestão 360 <contato@gestao360.org>');
  });

  it('não envia comentário interno ao solicitante', async () => {
    const { service } = serviceFor(true);

    await service.addInboxSupportTicketMessage({ sub: 'admin-1' } as never, ticket.id, {
      message: 'Anotação somente para a equipe.',
      isInternal: true,
    });

    expect(smtpMocks.resolveSmtpConfig).not.toHaveBeenCalled();
    expect(smtpMocks.sendMail).not.toHaveBeenCalled();
  });

  it('persiste e confirma a resposta sem aguardar o SMTP', async () => {
    let rejectSend!: (reason: Error) => void;
    smtpMocks.sendMail.mockReturnValue(new Promise((_, reject) => {
      rejectSend = reject;
    }));
    const { prisma, service } = serviceFor(false);

    await expect(service.addInboxSupportTicketMessage(
      { sub: 'admin-1' } as never,
      ticket.id,
      { message: 'Resposta visível ao cliente.', isInternal: false },
    )).resolves.toEqual(expect.objectContaining({ id: 'message-1', isInternal: false }));

    expect(prisma.supportTicketMessage.create).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(smtpMocks.sendMail).toHaveBeenCalledOnce());
    rejectSend(new Error('Connection timeout'));
  });
});
