import { Module } from '@nestjs/common';
import { ResultsModule } from '../results/results.module';
import { ExternalApiController } from './external-api.controller';
import { ExternalApiService } from './external-api.service';
import { ApiKeyGuard } from './api-key.guard';

@Module({
  imports: [ResultsModule],
  controllers: [ExternalApiController],
  providers: [ExternalApiService, ApiKeyGuard],
})
export class ExternalApiModule {}
