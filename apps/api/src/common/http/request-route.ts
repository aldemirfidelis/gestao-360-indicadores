/**
 * Deriva módulo/entidade a partir do path da request. Centraliza o parsing antes
 * duplicado entre o AuditInterceptor e o HttpMetricsInterceptor.
 */
export function routeParts(path: string): string[] {
  return path.replace(/^\/api\/?/, '').split('/').filter(Boolean);
}

export function routeModule(path: string, fallback = 'root'): string {
  return routeParts(path)[0] ?? fallback;
}

export function routeEntity(path: string, fallback = 'System'): string {
  const first = routeParts(path)[0];
  if (!first) return fallback;
  return first
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}
