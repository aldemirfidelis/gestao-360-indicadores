import { describe, it, expect } from 'vitest';
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
