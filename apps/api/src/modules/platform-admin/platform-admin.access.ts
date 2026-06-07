export const PLATFORM_WILDCARD = 'platform.*';

export function hasPlatformPermission(granted: Iterable<string>, required: string): boolean {
  const keys = new Set(granted);
  if (keys.has(PLATFORM_WILDCARD)) return true;
  if (keys.has(required)) return true;

  const parts = required.split('.');
  while (parts.length > 1) {
    parts.pop();
    if (keys.has(`${parts.join('.')}.*`)) return true;
  }

  return false;
}

export function canUseCompanyModule(status: string | null | undefined, method = 'GET'): {
  allowed: boolean;
  readOnly: boolean;
  reason?: string;
} {
  const normalized = (status ?? 'HERDADO_DO_PLANO').toUpperCase();
  if (['ATIVO', 'ACTIVE', 'HERDADO_DO_PLANO', 'EM_IMPLANTACAO', 'EM_TESTE', 'EXPERIMENTAL'].includes(normalized)) {
    return { allowed: true, readOnly: false };
  }
  if (['SOMENTE_LEITURA', 'READ_ONLY'].includes(normalized)) {
    return {
      allowed: method.toUpperCase() === 'GET',
      readOnly: true,
      reason: 'Modulo liberado somente para leitura.',
    };
  }
  if (['ATIVACAO_PROGRAMADA', 'EXPIRACAO_PROGRAMADA'].includes(normalized)) {
    return { allowed: true, readOnly: false };
  }
  return {
    allowed: false,
    readOnly: false,
    reason: 'Este recurso nao esta disponivel para a empresa selecionada.',
  };
}
