import { Controller, Get, Module } from '@nestjs/common';
import { InsightsService } from './insights.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';

@Controller('insights')
class InsightsController {
  constructor(private readonly service: InsightsService) {}

  @Get()
  list(@CurrentUser() me: AuthPayload) {
    return this.service.generate(me.companyId);
  }
}

@Module({
  controllers: [InsightsController],
  providers: [InsightsService],
  exports: [InsightsService],
})
export class InsightsModule {}
