import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';

/**
 * Global para que qualquer módulo (comunicação primeiro) possa migrar anexos do
 * banco para o Spaces sem novo wiring. Inerte até STORAGE_* estar configurado.
 */
@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
