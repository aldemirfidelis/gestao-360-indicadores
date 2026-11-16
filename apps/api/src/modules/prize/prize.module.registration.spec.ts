import { describe, it, expect, vi } from 'vitest';

// Módulos de produto ativos (ex.: Processos) entram por `require` dinâmico, que o vitest não
// resolve para arquivos .ts. Este teste só confere o import direto do PrizeModule.
vi.mock('../../parked-product-modules', () => ({ parkedProductModules: () => [] }));

import { AppModule } from '../../app.module';
import { PrizeModule } from './prize.module';

/**
 * Guarda contra regressao: o PrizeModule precisa estar registrado no AppModule,
 * senao as rotas /prize nao sao expostas em runtime (mesmo com tsc/testes verdes).
 */
describe('PrizeModule registration', () => {
  it('está registrado nos imports do AppModule', () => {
    const imports = Reflect.getMetadata('imports', AppModule) as unknown[];
    expect(imports).toBeDefined();
    expect(imports).toContain(PrizeModule);
  });
});
