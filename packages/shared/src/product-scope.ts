import scope from './product-scope.json';

export const PRODUCT_SCOPE = scope;
export const PUBLIC_DEMO_PROFILE = 'DEMO_PUBLIC';
export const PUBLIC_DEMO_EMAIL = 'visitante@demonstracao.local';
export const PUBLIC_DEMO_COMPANY_SLUG = 'demonstracao';

export function matchesRoute(path: string, prefix: string): boolean {
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  return clean === prefix || clean.startsWith(`${prefix}/`);
}
export function isProductModuleActive(code: string): boolean {
  return !scope.parkedModuleCodes.includes(code);
}
export function isProductRouteActive(path: string): boolean {
  return !scope.parkedWebRoutes.some((prefix) => matchesRoute(path, prefix));
}
export function isProductApiActive(path: string): boolean {
  return !scope.parkedApiRoutes.some((prefix) => matchesRoute(path, prefix));
}
export function isDemoRouteAllowed(path: string): boolean {
  if (matchesRoute(path, '/gestao-premio/integracoes')) return false;
  return isProductRouteActive(path) && scope.demoWebRoutes.some((prefix) => matchesRoute(path, prefix));
}
export function isDemoReadAllowed(path: string): boolean {
  if (['/prize/eligible/connectors', '/prize/eligible/jobs'].some((prefix) => matchesRoute(path, prefix))) return false;
  return isProductApiActive(path) && scope.demoApiRoutes.some((prefix) => matchesRoute(path, prefix));
}
export function isProductPermissionActive(key: string): boolean {
  if (key.startsWith('org:positions:') || key.startsWith('org:employees:') || key.startsWith('org:career:')) return false;
  const family = key.split(':')[0];
  return !['nc', 'doc', 'fsms', 'compras', 'estoque', 'approvals', 'automation', 'automations', 'risks', 'nonconformities', 'audits', 'documents', 'processes', 'forms', 'food-safety', 'asset-security', 'compensation', 'cargos-salarios', 'recruit', 'recruitment', 'saude', 'ponto', 'folha', 'pessoal', 'personnel', 'payroll', 'training', 'procurement', 'inventory', 'supplies', 'communication', 'directory'].includes(family);
}
