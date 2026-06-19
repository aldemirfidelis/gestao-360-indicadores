import { Controller, Get, Param } from '@nestjs/common';
import { AiService } from './ai.service';
import { GeminiService } from './gemini.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@Controller('ai')
export class AiController {
  constructor(
    private readonly service: AiService,
    private readonly gemini: GeminiService,
  ) {}

  @Get('status')
  @RequirePermissions('ai:status')
  status() {
    return { provider: this.gemini.provider, model: this.gemini.modelName, enabled: this.gemini.isEnabled };
  }

  @Get('indicators/:id/context')
  @RequirePermissions('ai:use')
  indicatorContext(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.buildIndicatorContext(id, me.companyId);
  }
}
