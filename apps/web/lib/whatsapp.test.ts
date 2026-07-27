import { describe, expect, it } from 'vitest';
import { normalizeWhatsappNumber, whatsappLink } from './whatsapp';

describe('normalizeWhatsappNumber', () => {
  it('celular com DDD (11 dígitos) recebe o DDI do Brasil', () => {
    expect(normalizeWhatsappNumber('64981009108')).toBe('5564981009108');
  });

  it('fixo com DDD (10 dígitos) também recebe o DDI', () => {
    expect(normalizeWhatsappNumber('6432112233')).toBe('556432112233');
  });

  it('limpa máscara digitada pelo usuário', () => {
    expect(normalizeWhatsappNumber('(64) 98100-9108')).toBe('5564981009108');
    expect(normalizeWhatsappNumber('+55 64 98100-9108')).toBe('5564981009108');
    expect(normalizeWhatsappNumber(' 64 9 8100 9108 ')).toBe('5564981009108');
  });

  it('não duplica o DDI de quem já veio com 55', () => {
    expect(normalizeWhatsappNumber('5564981009108')).toBe('5564981009108');
    expect(normalizeWhatsappNumber('556432112233')).toBe('556432112233');
  });

  it('preserva número internacional de outro país', () => {
    expect(normalizeWhatsappNumber('351912345678')).toBe('351912345678');
  });

  it('recusa o que não dá para discar', () => {
    expect(normalizeWhatsappNumber(null)).toBeNull();
    expect(normalizeWhatsappNumber('')).toBeNull();
    expect(normalizeWhatsappNumber('—')).toBeNull();
    expect(normalizeWhatsappNumber('1234')).toBeNull(); // ramal
    expect(normalizeWhatsappNumber('98100910')).toBeNull(); // sem DDD
  });
});

describe('whatsappLink', () => {
  it('monta a URL de conversa', () => {
    expect(whatsappLink('64981009108')).toBe('https://wa.me/5564981009108');
  });

  it('inclui a mensagem inicial codificada', () => {
    expect(whatsappLink('64981009108', 'Olá, Aldemir! Sobre a vaga & processo')).toBe(
      'https://wa.me/5564981009108?text=Ol%C3%A1%2C%20Aldemir!%20Sobre%20a%20vaga%20%26%20processo',
    );
  });

  it('mensagem vazia não vira querystring solta', () => {
    expect(whatsappLink('64981009108', '   ')).toBe('https://wa.me/5564981009108');
  });

  it('telefone inválido não gera link', () => {
    expect(whatsappLink('123')).toBeNull();
  });
});
