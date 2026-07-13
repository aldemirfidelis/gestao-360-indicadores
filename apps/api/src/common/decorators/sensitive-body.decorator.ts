import { SetMetadata } from '@nestjs/common';

/**
 * Impede que o corpo de uma requisição sensível seja persistido pela
 * auditoria HTTP global. A auditoria da operação continua existindo, mas grava
 * apenas um marcador de supressão no lugar do payload.
 */
export const SENSITIVE_BODY_KEY = 'audit:sensitive-body';

export const SensitiveBody = () => SetMetadata(SENSITIVE_BODY_KEY, true);
