import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILES, PERMISSION_CATALOG } from './permission-catalog';

const byCode = new Map<string, { role: string; permissions: readonly string[] }>(DEFAULT_PROFILES.map((p) => [p.code, p]));
const perms = (code: string) => new Set(byCode.get(code)?.permissions ?? []);

describe('DEFAULT_PROFILES — autoatendimento do colaborador', () => {
  it('Usuário e Visualizador batem ponto e veem a própria vida funcional', () => {
    for (const code of ['USUARIO', 'VISUALIZADOR']) {
      const p = perms(code);
      expect(p.has('ponto:view'), `${code} ponto:view`).toBe(true);
      expect(p.has('ponto:clock'), `${code} ponto:clock`).toBe(true);
      expect(p.has('folha:view'), `${code} folha:view`).toBe(true);
    }
  });

  it('existe o perfil enxuto Colaborador (Autoatendimento) sem acesso a indicadores/documentos', () => {
    const p = perms('COLABORADOR_AUTOATENDIMENTO');
    expect(byCode.get('COLABORADOR_AUTOATENDIMENTO')?.role).toBe('VIEWER');
    expect(p.has('ponto:clock')).toBe(true);
    expect(p.has('folha:view')).toBe(true);
    expect(p.has('indicators:view')).toBe(false);
    expect(p.has('doc:view')).toBe(false);
  });

  it('Gestor é o superior imediato: vê ponto da equipe, aprova (pessoal:update) e conduz requisições', () => {
    const p = perms('GESTOR');
    expect(p.has('ponto:team')).toBe(true);
    expect(p.has('pessoal:view')).toBe(true);
    expect(p.has('pessoal:update')).toBe(true);
    expect(p.has('folha:view')).toBe(true);
    expect(p.has('recruit:requisition:approve')).toBe(true);
  });

  it('todas as permissões dos perfis existem no catálogo (sem chave órfã)', () => {
    const catalog = new Set(PERMISSION_CATALOG.map(([key]) => key));
    for (const profile of DEFAULT_PROFILES) {
      for (const key of profile.permissions) {
        expect(catalog.has(key), `${profile.code} referencia permissão inexistente: ${key}`).toBe(true);
      }
    }
  });
});
