import { Module } from '@nestjs/common';
import { NonConformitiesModule } from '../nonconformities/nonconformities.module';
import { FoodSafetyController } from './food-safety.controller';
import { FoodSafetyService } from './food-safety.service';

// PrismaModule e AccessModule sao @Global. NonConformitiesModule e importado para
// abrir NC automaticamente em desvios (OUT) do monitoramento operacional.
@Module({
  imports: [NonConformitiesModule],
  controllers: [FoodSafetyController],
  providers: [FoodSafetyService],
  exports: [FoodSafetyService],
})
export class FoodSafetyModule {}
