import { describe, expect, it, vi, beforeEach } from 'vitest';
import { candidateAreaUrl } from './recruit-communication.service';

// O transporte é mockado no nível do módulo de SMTP: o teste verifica o que o
// serviço MANDA enviar, não a entrega em si.
const sendMail = vi.fn().mockResolvedValue({});

vi.mock('../../common/smtp', () => ({
  resolveSmtpConfig: vi.fn().mockResolvedValue({
    host: 'smtp-relay.brevo.com',
    port: 2525,
    secure: false,
    fromName: 'Gestão 360',
    fromAddress: 'contato@gestao360.org',
  }),
  buildTransport: () => ({ sendMail }),
  smtpFrom: (cfg: any) => `${cfg.fromName} <${cfg.fromAddress}>`,
}));

const { RecruitCommunicationService } = await import('./recruit-communication.service');

function service(company: any) {
  const prisma = {
    recruitEmailTemplate: { findFirst: vi.fn().mockResolvedValue(null) },
    company: { findUnique: vi.fn().mockResolvedValue(company) },
  };
  return new RecruitCommunicationService(prisma as any, { record: vi.fn() } as any);
}

describe('candidateAreaUrl', () => {
  it('inclui o slug da empresa para preservar o branding da tela', () => {
    expect(candidateAreaUrl('goiasa')).toContain('/candidato?empresa=goiasa');
  });

  it('sem slug, aponta para a área genérica', () => {
    expect(candidateAreaUrl(null)).toMatch(/\/candidato$/);
  });
});

describe('RecruitCommunicationService.sendEvent', () => {
  beforeEach(() => sendMail.mockClear());

  it('assina com o nome da EMPRESA, mantendo o endereço autenticado no DNS', async () => {
    await service({ name: 'Goiasa S/A', tradeName: 'Goiasa', slug: 'goiasa', email: 'rh@goiasa.com.br' }).sendEvent(
      'empresa-1',
      'APPLICATION_RECEIVED',
      'candidato@exemplo.com',
      { candidato: 'Aldemir', vaga: 'Gestor Administrativo', empresa: 'Goiasa' },
    );

    const sent = sendMail.mock.calls[0]![0];
    // Nome da empresa (o candidato se inscreveu nela)...
    expect(sent.from).toBe('Goiasa <contato@gestao360.org>');
    // ...mas o endereço continua o que tem DKIM/DMARC alinhado.
    expect(sent.from).toContain('contato@gestao360.org');
  });

  it('resposta vai para a empresa que contrata, não para a caixa da plataforma', async () => {
    await service({ name: 'Goiasa', tradeName: null, slug: 'goiasa', email: 'rh@goiasa.com.br' }).sendEvent(
      'empresa-1',
      'APPLICATION_RECEIVED',
      'candidato@exemplo.com',
      {},
    );
    expect(sendMail.mock.calls[0]![0].replyTo).toBe('rh@goiasa.com.br');
  });

  it('empresa sem e-mail cadastrado não define replyTo (evita respostas no vazio)', async () => {
    await service({ name: 'Empresa X', tradeName: null, slug: null, email: null }).sendEvent(
      'empresa-1',
      'APPLICATION_RECEIVED',
      'candidato@exemplo.com',
      {},
    );
    expect(sendMail.mock.calls[0]![0].replyTo).toBeUndefined();
  });

  it('envia texto e HTML, com o link da área do candidato nos dois', async () => {
    await service({ name: 'Goiasa', tradeName: null, slug: 'goiasa', email: null }).sendEvent(
      'empresa-1',
      'APPLICATION_RECEIVED',
      'candidato@exemplo.com',
      { candidato: 'Aldemir', vaga: 'Gestor', empresa: 'Goiasa' },
    );

    const sent = sendMail.mock.calls[0]![0];
    expect(sent.text).toContain('/candidato?empresa=goiasa');
    expect(sent.html).toContain('/candidato?empresa=goiasa');
    expect(sent.html).toContain('Acompanhe sua candidatura');
    // Rodapé explicando a origem automática, em ambas as versões.
    expect(sent.text).toContain('e-mail automático');
    expect(sent.html).toContain('e-mail automático');
  });

  it('pedido de documentos leva o rótulo de ação correspondente', async () => {
    await service({ name: 'Goiasa', tradeName: null, slug: 'goiasa', email: null }).sendEvent(
      'empresa-1',
      'DOCUMENTS_REQUESTED',
      'candidato@exemplo.com',
      { candidato: 'Aldemir', vaga: 'Gestor', empresa: 'Goiasa', documentos: '- RG', link: '' },
    );
    expect(sendMail.mock.calls[0]![0].html).toContain('Enviar meus documentos');
  });

  it('escapa HTML do corpo — o texto é configurável pela empresa', async () => {
    const prisma = {
      recruitEmailTemplate: {
        findFirst: vi.fn().mockResolvedValue({
          active: true,
          subject: 'Assunto',
          bodyText: 'Olá <script>alert(1)</script> & "aspas"',
        }),
      },
      company: { findUnique: vi.fn().mockResolvedValue({ name: 'Goiasa', tradeName: null, slug: null, email: null }) },
    };
    const svc = new RecruitCommunicationService(prisma as any, { record: vi.fn() } as any);
    await svc.sendEvent('empresa-1', 'APPLICATION_RECEIVED', 'candidato@exemplo.com', {});

    const html = sendMail.mock.calls[0]![0].html as string;
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('template desligado pela empresa não dispara e-mail', async () => {
    const prisma = {
      recruitEmailTemplate: { findFirst: vi.fn().mockResolvedValue({ active: false }) },
      company: { findUnique: vi.fn() },
    };
    const svc = new RecruitCommunicationService(prisma as any, { record: vi.fn() } as any);
    await svc.sendEvent('empresa-1', 'APPLICATION_RECEIVED', 'candidato@exemplo.com', {});
    expect(sendMail).not.toHaveBeenCalled();
  });
});
