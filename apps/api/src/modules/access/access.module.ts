import { Global, Module } from '@nestjs/common';
import { AccessService } from './access.service';
import { AccessAdminService } from './access-admin.service';
import { AccessAdminController } from './access-admin.controller';

/** Global: serviços de qualquer módulo podem injetar AccessService para o enforcement por área. */
@Global()
@Module({
  controllers: [AccessAdminController],
  providers: [AccessService, AccessAdminService],
  exports: [AccessService, AccessAdminService],
})
export class AccessModule {}
