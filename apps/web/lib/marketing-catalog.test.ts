import { describe, expect, it } from 'vitest';
import scope from '../../../packages/shared/src/product-scope.json';
import { activeProductModules, landingFaq, productGroups } from './marketing-catalog';
import {
  articlePages,
  DEFAULT_SITE_URL,
  publicMetadata,
  publicRoutes,
  softwareJsonLd,
  solutionPages,
  websiteJsonLd,
} from './public-site';

describe('catálogo público alinhado ao produto disponível', () => {
  it('não promove módulos suspensos e mantém destinos públicos válidos', () => {
    for (const item of activeProductModules) {
      expect(scope.parkedModuleCodes).not.toContain(item.code);
      expect(productGroups.some((group) => group.id === item.group)).toBe(true);
      expect(publicRoutes).toContain(item.href.split('#')[0]);
    }
    expect(new Set(publicRoutes).size).toBe(publicRoutes.length);
    for (const article of articlePages) {
      for (const path of article.related) expect(publicRoutes).toContain(path);
    }
  });

  it('expõe processos, projetos e documentos sem retirar soluções vigentes', () => {
    for (const slug of [
      'gestao-de-processos',
      'gestao-de-projetos',
      'gestao-de-documentos',
      'gestao-de-indicadores',
      'planejamento-estrategico',
      'planos-de-acao',
      'dashboards-executivos',
      'gestao-multiempresa',
    ]) {
      expect(solutionPages.some((page) => page.slug === slug)).toBe(true);
    }
  });

  it('mantém as condições da demonstração e da solicitação de avaliação', () => {
    expect(landingFaq).toHaveLength(8);
    expect(landingFaq.find((item) => item.question.includes('30 dias'))?.answer).toContain(
      'solicitação',
    );
    expect(landingFaq.find((item) => item.question.includes('demonstração'))?.answer).toContain(
      'sem cadastro prévio',
    );
    expect(
      landingFaq.find((item) => item.question.includes('inteligência artificial'))?.answer,
    ).toContain('conferência humana');
  });

  it('usa o domínio correto sem preços ou mecanismos de busca fictícios', () => {
    expect(DEFAULT_SITE_URL).toBe('https://gestao360.org');
    expect(softwareJsonLd()).not.toHaveProperty('offers');
    expect(websiteJsonLd()).not.toHaveProperty('potentialAction');
    expect(
      publicMetadata({ title: 'Teste | Gestão 360', description: 'Descrição', path: '/modulos' })
        .title,
    ).toEqual({ absolute: 'Teste | Gestão 360' });
  });
});
