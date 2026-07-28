import { describe, expect, it } from 'vitest';
import { linkedInShareUrl, truncate, vacancyOgDescription, vacancyPostText } from './share';

describe('linkedInShareUrl', () => {
  it('codifica a URL da vaga no compositor do LinkedIn', () => {
    expect(linkedInShareUrl('https://gestao360.org/carreiras/vagas/gestor?empresa=goiasa')).toBe(
      'https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fgestao360.org%2Fcarreiras%2Fvagas%2Fgestor%3Fempresa%3Dgoiasa',
    );
  });
});

describe('vacancyPostText', () => {
  const base = { title: 'Gestor Administrativo', url: 'https://gestao360.org/carreiras/vagas/gestor' };

  it('monta o post com empresa, local e contratação', () => {
    const texto = vacancyPostText({ ...base, companyName: 'Goiasa', city: 'Goiânia', workModeLabel: 'Presencial', contractLabel: 'CLT' });
    expect(texto).toContain('Vaga aberta: Gestor Administrativo');
    expect(texto).toContain('Empresa: Goiasa');
    expect(texto).toContain('Local: Goiânia · Presencial');
    expect(texto).toContain('Contratação: CLT');
    expect(texto).toContain(base.url);
  });

  it('omite as linhas sem dado, sem deixar rótulo órfão', () => {
    const texto = vacancyPostText(base);
    expect(texto).not.toContain('Empresa:');
    expect(texto).not.toContain('Local:');
    expect(texto).not.toContain('Contratação:');
    expect(texto).toContain('Vaga aberta: Gestor Administrativo');
  });

  it('só a cidade já forma a linha de local', () => {
    expect(vacancyPostText({ ...base, city: 'Goiânia' })).toContain('Local: Goiânia');
  });
});

describe('vacancyOgDescription', () => {
  it('junta cabeçalho e resumo da vaga', () => {
    const texto = vacancyOgDescription({
      title: 'Gestor',
      companyName: 'Goiasa',
      city: 'Goiânia',
      workModeLabel: 'Presencial',
      description: 'Responsável pela gestão administrativa da unidade.\n\nOutro parágrafo ignorado.',
    });
    expect(texto).toBe('Goiasa · Goiânia · Presencial — Responsável pela gestão administrativa da unidade.');
  });

  it('limpa marcação e marcador de lista do texto', () => {
    expect(vacancyOgDescription({ title: 'x', description: '- **Liderar** a equipe\n- Outro item' })).toContain('Liderar a equipe');
    expect(vacancyOgDescription({ title: 'x', description: '- **Liderar** a equipe' })).not.toContain('*');
  });

  it('sem nada, devolve um convite genérico em vez de string vazia', () => {
    expect(vacancyOgDescription({ title: 'x' })).toBe('Confira esta oportunidade e candidate-se.');
  });

  it('respeita o limite do card', () => {
    const longo = 'palavra '.repeat(80);
    expect(vacancyOgDescription({ title: 'x', description: longo }).length).toBeLessThanOrEqual(200);
  });
});

describe('truncate', () => {
  it('não mexe no que cabe', () => {
    expect(truncate('curto', 20)).toBe('curto');
  });

  it('corta no espaço para não partir palavra', () => {
    expect(truncate('gestor administrativo da unidade', 20)).toBe('gestor administrativo'.slice(0, 19).trimEnd() + '…');
  });

  it('palavra única gigante ainda é cortada', () => {
    expect(truncate('a'.repeat(50), 10)).toHaveLength(10);
  });
});
