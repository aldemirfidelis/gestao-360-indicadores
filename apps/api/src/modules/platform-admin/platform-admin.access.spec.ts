import { describe, expect, it } from 'vitest';
import { canUseCompanyModule, hasPlatformPermission } from './platform-admin.access';

describe('platform admin access helpers', () => {
  it('accepts exact and wildcard platform permissions', () => {
    expect(hasPlatformPermission(['platform.companies.view'], 'platform.companies.view')).toBe(true);
    expect(hasPlatformPermission(['platform.companies.*'], 'platform.companies.suspend')).toBe(true);
    expect(hasPlatformPermission(['platform.*'], 'platform.database.restore_request')).toBe(true);
    expect(hasPlatformPermission(['platform.users.view'], 'platform.modules.manage')).toBe(false);
  });

  it('blocks unavailable company modules without deleting data semantics', () => {
    expect(canUseCompanyModule('ATIVO', 'POST')).toMatchObject({ allowed: true, readOnly: false });
    expect(canUseCompanyModule('HERDADO_DO_PLANO', 'GET')).toMatchObject({ allowed: true });
    expect(canUseCompanyModule('SOMENTE_LEITURA', 'GET')).toMatchObject({ allowed: true, readOnly: true });
    expect(canUseCompanyModule('SOMENTE_LEITURA', 'POST')).toMatchObject({ allowed: false, readOnly: true });
    expect(canUseCompanyModule('BLOQUEADO', 'GET')).toMatchObject({ allowed: false });
    expect(canUseCompanyModule('SUSPENSO', 'PATCH')).toMatchObject({ allowed: false });
  });
});
