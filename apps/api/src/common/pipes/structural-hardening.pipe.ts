import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/**
 * Hardening estrutural GLOBAL de payloads (camada anterior ao Zod por módulo).
 *
 * Não valida contratos de negócio — bloqueia apenas formas abusivas que
 * nenhum payload legítimo da plataforma tem:
 *  - profundidade excessiva (anti-DoS de parser/recursão);
 *  - número absurdo de chaves/nós (anti-DoS de memória);
 *  - chaves de prototype pollution (__proto__, constructor, prototype).
 *
 * Limites GENEROSOS de propósito: boards de análise (Ishikawa/PDCA em JSON),
 * definições de workflow e formulários passam com folga.
 */
const MAX_DEPTH = 24;
const MAX_KEYS_PER_OBJECT = 512;
const MAX_TOTAL_NODES = 50_000;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

@Injectable()
export class StructuralHardeningPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    // Só inspeciona o body: params/query são strings curtas já tratadas adiante.
    if (metadata.type !== 'body' || value === null || typeof value !== 'object') return value;
    const state = { nodes: 0 };
    this.inspect(value, 0, state);
    return value;
  }

  private inspect(value: unknown, depth: number, state: { nodes: number }): void {
    if (value === null || typeof value !== 'object') return;
    if (depth > MAX_DEPTH) {
      throw new BadRequestException('Payload rejeitado: estrutura profunda demais.');
    }
    if (++state.nodes > MAX_TOTAL_NODES) {
      throw new BadRequestException('Payload rejeitado: estrutura grande demais.');
    }

    if (Array.isArray(value)) {
      for (const item of value) this.inspect(item, depth + 1, state);
      return;
    }

    const keys = Object.keys(value);
    if (keys.length > MAX_KEYS_PER_OBJECT) {
      throw new BadRequestException('Payload rejeitado: objeto com chaves demais.');
    }
    for (const key of keys) {
      if (FORBIDDEN_KEYS.has(key)) {
        // Remove em vez de rejeitar: JSON legítimo pode citar "constructor" como texto de chave? Não — chave proibida some sem quebrar o resto.
        delete (value as Record<string, unknown>)[key];
        continue;
      }
      this.inspect((value as Record<string, unknown>)[key], depth + 1, state);
    }
  }
}
