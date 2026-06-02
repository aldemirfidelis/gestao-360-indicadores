import { SetMetadata } from '@nestjs/common';
import { DbAdminSubmenu } from '../database-admin.constants';

export const DB_ADMIN_SUBMENU_KEY = 'dbAdminSubmenu';

/** Marca o submenu de origem para fins de auditoria/contexto. */
export const DbAdminSubmenuTag = (submenu: DbAdminSubmenu) => SetMetadata(DB_ADMIN_SUBMENU_KEY, submenu);
