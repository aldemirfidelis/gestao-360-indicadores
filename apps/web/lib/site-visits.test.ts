import { describe, expect, it } from 'vitest';
import { clickLabel, deepestSection, demoPageLabel, eventText, fmtDay, fmtDuration, placeLabel, sitePageLabel, stateName, visitResult } from './site-visits';

describe('visitantes do site', () => {
  it('formata o tempo na página e o dia', () => {
    expect(fmtDuration(0)).toBe('0 s');
    expect(fmtDuration(42_400)).toBe('42 s');
    expect(fmtDuration(75_000)).toBe('1 min 15 s');
    expect(fmtDuration(120_000)).toBe('2 min');
    expect(fmtDuration(3_900_000)).toBe('1 h 5 min');
    expect(fmtDay('2026-10-31')).toBe('31/10');
  });

  it('classifica o resultado da visita como os filtros da API', () => {
    const base = { whatsappAt: null, formAt: null, demoStartedAt: null, demoPathCount: 0, firstDemoClickAt: null, pageViews: 1, maxScrollPct: 0, activeMs: 0 };
    expect(visitResult(base)).toBe('bounced');
    expect(visitResult({ ...base, pageViews: 3 })).toBe('browsed');
    expect(visitResult({ ...base, maxScrollPct: 60 })).toBe('browsed');
    expect(visitResult({ ...base, firstDemoClickAt: 'x' })).toBe('demo_clicked');
    expect(visitResult({ ...base, firstDemoClickAt: 'x', demoStartedAt: 'y', demoPathCount: 1 })).toBe('demo_entered');
    expect(visitResult({ ...base, demoStartedAt: 'y', demoPathCount: 4 })).toBe('demo_navigated');
    expect(visitResult({ ...base, demoStartedAt: 'y', demoPathCount: 4, whatsappAt: 'z' })).toBe('contacted');
    expect(visitResult({ ...base, formAt: 'z' })).toBe('contacted');
  });

  it('mostra local, estado e seção mais abaixo', () => {
    expect(placeLabel({ geoAt: null, city: null, region: null, country: null })).toBe('Localizando…');
    expect(placeLabel({ geoAt: 'x', city: null, region: null, country: null })).toBe('Não identificado');
    expect(placeLabel({ geoAt: 'x', city: 'Goiânia', region: 'GO', country: 'BR' })).toBe('Goiânia · GO');
    expect(stateName('GO')).toBe('GO · Goiás');
    expect(deepestSection(['inicio', 'chamada-final', 'frentes'])).toBe('chamada-final');
    expect(deepestSection([])).toBeNull();
  });

  it('dá nome às páginas do site e da demonstração', () => {
    expect(sitePageLabel('/')).toBe('Página inicial');
    expect(sitePageLabel('/solucoes/gestao-de-indicadores')).toBe('Solução: Gestão de indicadores');
    expect(sitePageLabel('/pagina-nova')).toBe('/pagina-nova');
    expect(demoPageLabel('/meu-dia')).toBe('Meu Dia');
    expect(demoPageLabel('/indicators/:id')).toBe('Indicadores › detalhe');
    expect(demoPageLabel('/gestao-premio/espelhos')).toBe('Gestão de Prêmio › Espelhos');
  });

  it('descreve cliques e eventos', () => {
    expect(clickLabel('demo_click', 'home_hero')).toBe('Demonstração · Topo da página inicial');
    expect(clickLabel('whatsapp_click', 'demo_floating_card')).toBe('WhatsApp · card da demonstração');
    expect(clickLabel('form_submit', 'Trial de 30 dias')).toBe('Formulário · Trial de 30 dias');
    expect(eventText({ type: 'demo_start', label: null, path: '/demonstracao' })).toBe('Entrou na demonstração');
    expect(eventText({ type: 'demo_page', label: null, path: '/strategy' })).toBe('Na demo, abriu Mapa Estratégico (BSC)');
    expect(eventText({ type: 'page_view', label: null, path: '/teste-gratis' })).toBe('Abriu Trial de 30 dias');
    expect(eventText({ type: 'scroll', label: '100', path: '/' })).toBe('Rolou a página inicial até o fim');
  });
});
