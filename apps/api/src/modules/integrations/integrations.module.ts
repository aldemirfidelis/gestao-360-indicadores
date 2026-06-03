import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { ExternalIntegrationController } from './external-integration.controller';
import { ExternalIntegrationService } from './external-integration.service';
import { ResultsModule } from '../results/results.module';

@Module({
  imports: [ResultsModule],
  controllers: [IntegrationsController, ExternalIntegrationController],
  providers: [IntegrationsService, ExternalIntegrationService],
  exports: [ExternalIntegrationService],
})
export class IntegrationsModule {}
