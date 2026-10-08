import { describe, expect, it } from 'vitest';
import {
  canAccessRoute,
  defaultLandingFor,
  visibleAllNavSections,
  visibleNavSections,
  visiblePortalServiceSections,
} from './navigation';

describe('granular navigation', () => {
  it('mostra apenas as quatro abas de negócio mesmo para super admin', () => {
    const user = { role: 'SUPER_ADMIN', permissions: [] };
    expect(visibleNavSections(user).map(section => section.heading)).toEqual(['Meu Dia', 'Tarefas', 'Gestão à Vista', 'Gestão de Prêmio']);
    expect(canAccessRoute(user, '/documents')).toBe(false);
    expect(canAccessRoute(user, '/servico-pessoal')).toBe(false);
  });
  it('visitante demo só encontra os módulos apresentados', () => {
    const user = { role: 'COMPANY_ADMIN', isDemo: true, permissions: ['myday:view', 'indicators:view', 'prize:view', 'settings:manage'] };
    expect(visiblePortalServiceSections(user)).toEqual([]);
    expect(canAccessRoute(user, '/settings')).toBe(false);
    expect(canAccessRoute(user, '/gestao-premio/integracoes')).toBe(false);
    expect(canAccessRoute(user, '/indicators')).toBe(true);
  });
  it('does not expose Meu Dia or Tarefas without myday:view', () => {
    const user = { role: 'VIEWER', permissions: ['indicators:view'] };
    const hrefs = visibleAllNavSections(user).flatMap((section) =>
      section.items.map((item) => item.href),
    );

    expect(hrefs).toContain('/indicators');
    expect(hrefs).not.toContain('/meu-dia');
    expect(hrefs).not.toContain('/tarefas');
    expect(defaultLandingFor(user)).toBe('/indicators');
  });

  it('does not expose suspended Totem routes', () => {
    const user = { role: 'VIEWER', permissions: ['ponto:kiosk'] };
    const hrefs = visibleAllNavSections(user).flatMap((section) =>
      section.items.map((item) => item.href),
    );

    expect(hrefs).toEqual([]);
    expect(canAccessRoute(user, '/totem')).toBe(false);
    expect(canAccessRoute(user, '/meu-dia')).toBe(false);
    expect(canAccessRoute(user, '/tarefas')).toBe(false);
  });

  it('ignores a saved landing page that the user can no longer access', () => {
    const user = { role: 'VIEWER', permissions: ['help:view'] };

    expect(defaultLandingFor(user, '/meu-dia')).toBe('/central-atendimento');
  });

  it('protects secondary utility routes from a single-module profile', () => {
    const user = { role: 'VIEWER', permissions: ['indicators:view'] };

    expect(canAccessRoute(user, '/scan')).toBe(false);
    expect(canAccessRoute(user, '/perfil/another-user')).toBe(false);
    expect(canAccessRoute(user, '/gestao-premio/integracoes')).toBe(false);
  });

  it('keeps duplicated administrative shortcuts out of the portal services menu', () => {
    const user = {
      role: 'ADMIN',
      permissions: [
        'help:view',
        'settings:manage',
        'users:manage',
        'company-data:view',
        'integrations:view',
        'audit:view',
      ],
    };
    const hrefs = visiblePortalServiceSections(user).flatMap((section) =>
      section.items.map((item) => item.href),
    );

    expect(hrefs).toEqual(['/central-atendimento', '/settings']);
  });
});
