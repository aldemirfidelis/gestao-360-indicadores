import { describe, expect, it } from 'vitest';
import { ProjectsModule } from '../projects/projects.module';
import { ProjectsService } from '../projects/projects.service';
import { ProcessesModule } from './processes.module';
import { ProcessPmoController } from './process-pmo.controller';
import { ProcessPmoService } from './process-pmo.service';

/**
 * Guarda contra regressão: o PMO de processos depende do ProjectsService. Sem o import do
 * ProjectsModule (que o exporta) a API não sobe, mesmo com tsc e testes de serviço verdes.
 */
describe('ProcessesModule - PMO integrado', () => {
  it('registra o controller e o serviço do PMO e importa o módulo Projetos', () => {
    expect(Reflect.getMetadata('controllers', ProcessesModule)).toContain(ProcessPmoController);
    expect(Reflect.getMetadata('providers', ProcessesModule)).toContain(ProcessPmoService);
    expect(Reflect.getMetadata('imports', ProcessesModule)).toContain(ProjectsModule);
    expect(Reflect.getMetadata('exports', ProjectsModule)).toContain(ProjectsService);
  });
});
