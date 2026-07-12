import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { ProcurementController } from './procurement.controller';
import { ProcurementService } from './procurement.service';
import { AdvancedSuppliesController } from './advanced-supplies.controller';
import { AdvancedSuppliesService } from './advanced-supplies.service';

@Module({
  controllers: [InventoryController, ProcurementController, AdvancedSuppliesController],
  providers: [InventoryService, ProcurementService, AdvancedSuppliesService],
  exports: [InventoryService, ProcurementService],
})
export class SuppliesModule {}
