/**
 * Gera o SQL de RESET de permissões (rodar LOCALMENTE; aplicar via psql na prod):
 *   pnpm --filter @g360/api exec tsx prisma/reset-permissions.gen-sql.ts > reset-permissions.sql
 *
 * O que o SQL faz (transacional):
 *  1) Empresas veem TODOS os módulos: limpa PlatformCompanyModule (sem override => liberado).
 *  2) Reset por usuário -> padrão do cargo: limpa accessProfile + grants diretos e
 *     reinsere as permissões padrão do role (DEFAULT_PROFILES). DIRECTOR/ANALYST
 *     (sem perfil padrão) usam o baseline de MANAGER.
 */
import { DEFAULT_PROFILES } from '../src/modules/users/permission-catalog';

const byRole = new Map<string, string[]>();
for (const p of DEFAULT_PROFILES as Array<{ role: string; permissions: string[] }>) {
  byRole.set(p.role, p.permissions);
}
const MANAGER = byRole.get('MANAGER') ?? [];
const roleKeys: Record<string, string[]> = {
  SUPER_ADMIN: byRole.get('SUPER_ADMIN') ?? [],
  COMPANY_ADMIN: byRole.get('COMPANY_ADMIN') ?? [],
  MANAGER,
  COLLABORATOR: byRole.get('COLLABORATOR') ?? [],
  VIEWER: byRole.get('VIEWER') ?? [],
  DIRECTOR: MANAGER, // sem perfil padrão -> baseline operacional
  ANALYST: MANAGER, // sem perfil padrão -> baseline operacional
};

const arr = (keys: string[]) => `ARRAY[${[...new Set(keys)].map((k) => `'${k.replace(/'/g, "''")}'`).join(',')}]::text[]`;

let sql = 'BEGIN;\n';
sql += 'DELETE FROM "PlatformCompanyModule";\n';
sql += 'UPDATE "User" SET "accessProfileId" = NULL WHERE "deletedAt" IS NULL;\n';
sql += 'DELETE FROM "UserPermission" WHERE "userId" IN (SELECT id FROM "User" WHERE "deletedAt" IS NULL);\n';
for (const [role, keys] of Object.entries(roleKeys)) {
  if (!keys.length) continue;
  sql +=
    `INSERT INTO "UserPermission" ("userId","permissionId")\n` +
    `  SELECT u.id, p.id FROM "User" u\n` +
    `  JOIN "Permission" p ON p.key = ANY(${arr(keys)})\n` +
    `  WHERE u."deletedAt" IS NULL AND u.role = '${role}'\n` +
    `  ON CONFLICT DO NOTHING;\n`;
}
sql += 'COMMIT;\n';
process.stdout.write(sql);
