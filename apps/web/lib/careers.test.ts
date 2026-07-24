import { describe, expect, it } from 'vitest';
import { candidatePortalPath, careersImageUrl, companyCareersPath, publicVacancyPath } from './careers';

describe('rotas públicas de carreiras', () => {
  it('gera a página própria da empresa com slug seguro', () => {
    expect(companyCareersPath('empresa teste')).toBe('/carreiras/empresa%20teste');
  });

  it('mantém o contexto da empresa no detalhe da vaga', () => {
    expect(publicVacancyPath('analista-senior', 'acme')).toBe('/carreiras/vagas/analista-senior?empresa=acme');
  });

  it('mantém o portal do candidato global com contexto opcional', () => {
    expect(candidatePortalPath()).toBe('/candidato');
    expect(candidatePortalPath('acme')).toBe('/candidato?empresa=acme');
  });

  it('resolve assets internos da API sem alterar URLs externas', () => {
    expect(careersImageUrl('https://cdn.exemplo.com/logo.png')).toBe('https://cdn.exemplo.com/logo.png');
    expect(careersImageUrl('/careers/assets/logo?empresa=acme')).toContain('/api/careers/assets/logo?empresa=acme');
  });
});
