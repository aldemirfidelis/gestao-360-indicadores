import { describe, expect, it } from 'vitest';
import {
  canAccessRoute,
  defaultLandingFor,
  visibleAllNavSections,
} from './navigation';

describe('granular navigation', () => {
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

  it('keeps the Totem profile navigation exclusive', () => {
    const user = { role: 'VIEWER', permissions: ['ponto:kiosk'] };
    const hrefs = visibleAllNavSections(user).flatMap((section) =>
      section.items.map((item) => item.href),
    );

    expect(hrefs).toEqual(['/totem']);
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
});
