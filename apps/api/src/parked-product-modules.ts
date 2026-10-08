import { Module, type DynamicModule } from '@nestjs/common';
import { isProductModuleActive, PRODUCT_SCOPE } from '@g360/shared';

@Module({})
class ParkedProductModule {}

/** Código preservado no repositório; módulos em espera não são carregados. */
export function parkedProductModules(): DynamicModule[] {
  const entries = PRODUCT_SCOPE.backendModules;
  const imports = entries.filter(([code]) => isProductModuleActive(code)).map(([, folder, name]) =>
    require(`./modules/${folder}/${folder}.module`)[name],
  );
  const providers = [];
  if (isProductModuleActive('documents')) providers.push({ provide: 'parked.documents', useExisting: require('./modules/documents/documents.service').DocumentsService });
  if (isProductModuleActive('automations')) providers.push({ provide: 'parked.approvals', useExisting: require('./modules/automations/services/workflow-approval.service').WorkflowApprovalService });
  return imports.length ? [{ module: ParkedProductModule, global: true, imports, providers, exports: providers.map((p) => p.provide) }] : [];
}
