import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { matchesImageSignature, normalizeCareerPageInput } from './recruit-careers.service';

describe('configuração da página de carreiras', () => {
  it('normaliza modelo, cores, textos e URLs públicas', () => {
    const result = normalizeCareerPageInput({
      template: 'modern',
      heroAlignment: 'center',
      primaryColor: '#AABBCC',
      headline: '  Faça parte do nosso time  ',
      websiteUrl: 'https://example.com/carreiras',
      published: true,
    });

    expect(result).toMatchObject({
      template: 'MODERN',
      heroAlignment: 'CENTER',
      primaryColor: '#aabbcc',
      headline: 'Faça parte do nosso time',
      websiteUrl: 'https://example.com/carreiras',
      published: true,
    });
  });

  it('bloqueia cores e protocolos inseguros', () => {
    expect(() => normalizeCareerPageInput({ primaryColor: 'red' })).toThrow(BadRequestException);
    expect(() => normalizeCareerPageInput({ bannerUrl: 'javascript:alert(1)' })).toThrow(BadRequestException);
  });

  it('confere a assinatura real de imagens enviadas', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(matchesImageSignature(png, 'image/png')).toBe(true);
    expect(matchesImageSignature(Buffer.from('não é uma imagem'), 'image/png')).toBe(false);
  });
});
