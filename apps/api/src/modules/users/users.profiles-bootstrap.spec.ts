import { afterEach, describe, expect, it, vi } from 'vitest';
import { UsersService } from './users.service';
import { DEFAULT_PROFILES, PERMISSION_CATALOG } from './permission-catalog';

type ProfileRow = { id: string; companyId: string; code: string; keys: string[] };

const defaultsOf = (code: string) => [...(DEFAULT_PROFILES.find((profile) => profile.code === code)?.permissions ?? [])] as string[];

function makeService(companies: string[], profiles: ProfileRow[]) {
  const permissions = PERMISSION_CATALOG.map(([key], index) => ({ id: `perm-${index}`, key }));
  const idByKey = new Map<string, string>(permissions.map((permission) => [permission.key, permission.id]));
  const prisma: any = {
    permission: {
      findMany: vi.fn(async (args?: any) => {
        const keys: string[] | undefined = args?.where?.key?.in;
        return keys ? permissions.filter((permission) => keys.includes(permission.key)) : permissions;
      }),
      createMany: vi.fn(),
    },
    company: { findMany: vi.fn(async () => companies.map((id) => ({ id }))) },
    accessProfile: {
      findMany: vi.fn(async ({ where }: any) =>
        profiles
          .filter((profile) => profile.companyId === where.companyId && where.code.in.includes(profile.code))
          .map((profile) => ({ id: profile.id, code: profile.code, permissions: profile.keys.map((key) => ({ permissionId: idByKey.get(key) })) })),
      ),
    },
    profilePermission: { createMany: vi.fn(async ({ data }: any) => ({ count: data.length })) },
  };
  return { service: new UsersService(prisma), prisma, idByKey };
}

describe('UsersService — perfis de sistema reconciliados no boot', () => {
  afterEach(() => {
    delete process.env.COMPANY_PROFILES_BOOTSTRAP_DISABLED;
  });

  it('acrescenta as permissões de Documentos que faltam aos perfis de sistema de todas as empresas', async () => {
    const adminWithoutDocs = defaultsOf('ADMIN').filter((key) => !key.startsWith('doc:'));
    const userWithoutDocView = defaultsOf('USUARIO').filter((key) => key !== 'doc:view');
    const { service, prisma, idByKey } = makeService(['empresa-a', 'empresa-b'], [
      { id: 'a-admin', companyId: 'empresa-a', code: 'ADMIN', keys: adminWithoutDocs },
      { id: 'a-custom', companyId: 'empresa-a', code: 'PERSONALIZADO_QUALIDADE', keys: [] },
      { id: 'b-usuario', companyId: 'empresa-b', code: 'USUARIO', keys: userWithoutDocView },
      { id: 'b-gestor', companyId: 'empresa-b', code: 'GESTOR', keys: defaultsOf('GESTOR') },
    ]);

    const result = await service.reconcileSystemProfilesOfAllCompanies();

    const adminDocKeys = defaultsOf('ADMIN').filter((key) => key.startsWith('doc:'));
    expect(adminDocKeys).toHaveLength(13);
    expect(result).toEqual({ companies: 2, granted: adminDocKeys.length + 1 });
    const granted = prisma.profilePermission.createMany.mock.calls.flatMap(([args]: any[]) => args.data);
    expect(granted).toEqual([
      ...adminDocKeys.map((key) => ({ profileId: 'a-admin', permissionId: idByKey.get(key) })),
      { profileId: 'b-usuario', permissionId: idByKey.get('doc:view') },
    ]);
    // Só perfis de sistema com padrão no catálogo: o personalizado não é tocado.
    expect(granted.some((entry: any) => entry.profileId === 'a-custom')).toBe(false);
    // Uma leitura do catálogo de permissões serve para todas as empresas.
    expect(prisma.permission.findMany).toHaveBeenCalledTimes(2);
  });

  it('perfis já completos não geram escrita', async () => {
    const { service, prisma } = makeService(['empresa-a'], [
      { id: 'a-visualizador', companyId: 'empresa-a', code: 'VISUALIZADOR', keys: defaultsOf('VISUALIZADOR') },
    ]);
    expect(await service.reconcileSystemProfilesOfAllCompanies()).toEqual({ companies: 1, granted: 0 });
    expect(prisma.profilePermission.createMany).not.toHaveBeenCalled();
  });

  it('no boot, pode ser desligado e nunca derruba a API', async () => {
    process.env.COMPANY_PROFILES_BOOTSTRAP_DISABLED = '1';
    const disabled = makeService(['empresa-a'], []);
    await disabled.service.onApplicationBootstrap();
    expect(disabled.prisma.company.findMany).not.toHaveBeenCalled();

    delete process.env.COMPANY_PROFILES_BOOTSTRAP_DISABLED;
    const failing = makeService(['empresa-a'], []);
    failing.prisma.company.findMany.mockRejectedValueOnce(new Error('banco indisponível'));
    await expect(failing.service.onApplicationBootstrap()).resolves.toBeUndefined();
  });
});
