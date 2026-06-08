import { Module } from '@nestjs/common';
import { FoodSafetyController } from './food-safety.controller';
import { FoodSafetyService } from './food-safety.service';

// PrismaModule e AccessModule sao @Global — nao precisam ser importados aqui.
@Module({
  controllers: [FoodSafetyController],
  providers: [FoodSafetyService],
  exports: [FoodSafetyService],
})
export class FoodSafetyModule {}
