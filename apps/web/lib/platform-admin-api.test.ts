import { describe, expect, it } from 'vitest';
import { normalizePlatformAdminPath } from './platform-admin-api';

describe('normalizePlatformAdminPath', () => {
  it('mantém uma rota relativa ao Portal Administrativo Global', () => {
    expect(normalizePlatformAdminPath('/inbox/support-tickets')).toBe('/inbox/support-tickets');
  });

  it('adiciona a barra inicial quando necessário', () => {
    expect(normalizePlatformAdminPath('inbox/contacts')).toBe('/inbox/contacts');
  });

  it('remove um prefixo platform-admin duplicado', () => {
    expect(normalizePlatformAdminPath('/platform-admin/inbox/support-tickets')).toBe('/inbox/support-tickets');
  });
});
