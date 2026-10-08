import { isProductPermissionActive } from '@g360/shared';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILES, PERMISSION_CATALOG } from './permission-catalog';

const byCode = new Map<string, { role: string; permissions: readonly string[] }>(DEFAULT_PROFILES.map((p) => [p.code, p]));
const perms = (code: string) => new Set(byCode.get(code)?.permissions ?? []);

describe('DEFAULT_PROFILES — autoatendimento do colaborador', () => {
  it('Usuário e Visualizador batem ponto e veem a própria vida funcional', () => {
    for (const code of ['USUARIO', 'VISUALIZADOR']) {
      const p = perms(code);
      expect(p.has('ponto:view'), `${code} ponto:view`).toBe(isProductPermissionActive('ponto:view'));
      expect(p.has('ponto:clock'), `${code} ponto:clock`).toBe(isProductPermissionActive('ponto:clock'));
      expect(p.has('folha:view'), `${code} folha:view`).toBe(isProductPermissionActive('folha:view'));
    }
  });

  it('Colaborador (Ponto no Totem) vê a vida funcional mas NÃO bate ponto pelo portal', () => {
    const p = perms('COLABORADOR_PONTO_TOTEM');
    expect(byCode.get('COLABORADOR_PONTO_TOTEM')?.role).toBe('VIEWER');
    // Continua consultando espelho, holerite e comunicação interna...
    expect(p.has('ponto:view')).toBe(isProductPermissionActive('ponto:view'));
    expect(p.has('folha:view')).toBe(isProductPermissionActive('folha:view'));
    expect(p.has('communication:view')).toBe(isProductPermissionActive('communication:view'));
    // ...mas a marcação só acontece no totem.
    expect(p.has('ponto:clock')).toBe(false);
    expect(p.has('ponto:kiosk')).toBe(false);
  });

  it('existe o perfil enxuto Colaborador (Autoatendimento) sem acesso a indicadores/documentos', () => {
    const p = perms('COLABORADOR_AUTOATENDIMENTO');
    expect(byCode.get('COLABORADOR_AUTOATENDIMENTO')?.role).toBe('VIEWER');
    expect(p.has('ponto:clock')).toBe(isProductPermissionActive('ponto:clock'));
    expect(p.has('folha:view')).toBe(isProductPermissionActive('folha:view'));
    expect(p.has('indicators:view')).toBe(false);
    expect(p.has('doc:view')).toBe(false);
  });

  it('Gestor é o superior imediato: vê ponto da equipe, aprova (pessoal:update) e conduz requisições', () => {
    const p = perms('GESTOR');
    expect(p.has('ponto:team')).toBe(isProductPermissionActive('ponto:team'));
    expect(p.has('pessoal:view')).toBe(isProductPermissionActive('pessoal:view'));
    expect(p.has('pessoal:update')).toBe(isProductPermissionActive('pessoal:update'));
    expect(p.has('folha:view')).toBe(isProductPermissionActive('folha:view'));
    expect(p.has('recruit:requisition:approve')).toBe(isProductPermissionActive('recruit:requisition:approve'));
  });

  it('todas as permissões dos perfis existem no catálogo (sem chave órfã)', () => {
    const catalog = new Set(PERMISSION_CATALOG.map(([key]) => key));
    for (const profile of DEFAULT_PROFILES) {
      for (const key of profile.permissions) {
        expect(catalog.has(key), `${profile.code} referencia permissão inexistente: ${key}`).toBe(true);
      }
    }
  });

  it('dados administrativos ficam no perfil dedicado e nao sao liberados ao analista generico', () => {
    expect(perms('OPERADOR_DADOS').has('company-data:view')).toBe(true);
    expect(perms('OPERADOR_DADOS').has('company-data:export')).toBe(true);
    expect(perms('ANALISTA').has('company-data:view')).toBe(false);
    expect(perms('DIRETORIA').has('company-data:export')).toBe(false);
  });
});
