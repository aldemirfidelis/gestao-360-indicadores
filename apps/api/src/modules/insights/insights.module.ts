import { Controller, Get, Module } from '@nestjs/common';
import { InsightsService } from './insights.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { AiModule } from '../ai/ai.module';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@Controller('insights')
@RequirePermissions('insights:view')
class InsightsController {
  constructor(private readonly service: InsightsService) {}

  @Get()
  list(@CurrentUser() me: AuthPayload) {
    return this.service.generate(me);
  }
}

@Module({
  imports: [AiModule],
  controllers: [InsightsController],
  providers: [InsightsService],
  exports: [InsightsService],
})
export class InsightsModule {}
