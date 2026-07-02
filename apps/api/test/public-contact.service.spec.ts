import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PublicContactService,
  publicContactDestination,
} from '../src/modules/public/public-contact.service';

const smtpMocks = vi.hoisted(() => ({
  sendMail: vi.fn(),
  resolveSmtpConfig: vi.fn(),
  buildTransport: vi.fn(),
  smtpFrom: vi.fn(),
}));

const prismaMocks = vi.hoisted(() => ({
  createContact: vi.fn(),
}));

vi.mock('../src/common/smtp', () => ({
  resolveSmtpConfig: smtpMocks.resolveSmtpConfig,
  buildTransport: smtpMocks.buildTransport,
  smtpFrom: smtpMocks.smtpFrom,
}));

const originalSupportEmail = process.env.PUBLIC_SUPPORT_EMAIL;
const originalContactEmail = process.env.PUBLIC_CONTACT_EMAIL;

beforeEach(() => {
  smtpMocks.sendMail.mockReset().mockResolvedValue({ messageId: 'test' });
  smtpMocks.resolveSmtpConfig.mockReset().mockResolvedValue({ host: 'smtp.example.com' });
  smtpMocks.buildTransport.mockReset().mockReturnValue({ sendMail: smtpMocks.sendMail });
  smtpMocks.smtpFrom.mockReset().mockReturnValue('Gestão 360 <no-reply@example.com>');
  prismaMocks.createContact.mockReset().mockResolvedValue({ id: 'contact-1' });
});

afterEach(() => {
  if (originalSupportEmail === undefined) delete process.env.PUBLIC_SUPPORT_EMAIL;
  else process.env.PUBLIC_SUPPORT_EMAIL = originalSupportEmail;

  if (originalContactEmail === undefined) delete process.env.PUBLIC_CONTACT_EMAIL;
  else process.env.PUBLIC_CONTACT_EMAIL = originalContactEmail;
});

describe('publicContactDestination', () => {
  it('encaminha suporte e LGPD somente para o canal de suporte', () => {
    delete process.env.PUBLIC_SUPPORT_EMAIL;

    expect(publicContactDestination('Suporte técnico')).toBe('suporte@gestao360.org');
    expect(publicContactDestination('LGPD e privacidade')).toBe('suporte@gestao360.org');
  });

  it('encaminha trial e comercial para o canal de contato', () => {
    delete process.env.PUBLIC_CONTACT_EMAIL;

    expect(publicContactDestination('Trial de 30 dias')).toBe('contato@gestao360.org');
    expect(publicContactDestination('Comercial')).toBe('contato@gestao360.org');
  });

  it('permite configurar os destinatários apenas pelo servidor', () => {
    process.env.PUBLIC_SUPPORT_EMAIL = 'help@example.com';
    process.env.PUBLIC_CONTACT_EMAIL = 'sales@example.com';

    expect(publicContactDestination('SAC')).toBe('help@example.com');
    expect(publicContactDestination('Demonstração')).toBe('sales@example.com');
  });

  it('envia o formulário ao destinatário calculado com reply-to do solicitante', async () => {
    const service = new PublicContactService({
      publicContactMessage: { create: prismaMocks.createContact },
    } as never);

    await service.send({
      name: 'Pessoa Teste',
      company: 'Empresa Teste',
      email: 'pessoa@example.com',
      requestType: 'Trial de 30 dias',
      message: 'Quero avaliar os módulos do portal durante o trial.',
      privacy: 'accepted',
    });

    expect(prismaMocks.createContact).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(smtpMocks.sendMail).toHaveBeenCalledOnce());
    expect(smtpMocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'contato@gestao360.org',
        replyTo: 'pessoa@example.com',
        subject: expect.stringContaining('Trial de 30 dias'),
      }),
    );
  });

  it('confirma a submissão sem aguardar um SMTP indisponível', async () => {
    let rejectSend!: (reason: Error) => void;
    smtpMocks.sendMail.mockReturnValue(new Promise((_, reject) => {
      rejectSend = reject;
    }));
    const service = new PublicContactService({
      publicContactMessage: { create: prismaMocks.createContact },
    } as never);

    await expect(service.send({
      name: 'Pessoa Teste',
      company: 'Empresa Teste',
      email: 'pessoa@example.com',
      requestType: 'Comercial',
      message: 'Preciso de mais informações sobre o portal.',
      privacy: 'accepted',
    })).resolves.toEqual({ ok: true });

    expect(prismaMocks.createContact).toHaveBeenCalledOnce();
    rejectSend(new Error('Connection timeout'));
  });
});
