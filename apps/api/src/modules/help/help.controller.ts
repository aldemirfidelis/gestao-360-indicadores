import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { HelpService } from './help.service';

@Controller('help')
export class HelpController {
  constructor(private readonly service: HelpService) {}

  @Get()
  summary(@Query('q') query?: string) {
    return this.service.summary(query);
  }

  @Get('articles/:slug')
  article(@Param('slug') slug: string) {
    return this.service.article(slug);
  }

  @Post('articles/:slug/feedback')
  feedback(@CurrentUser() me: AuthPayload, @Param('slug') slug: string, @Body() body: { helpful?: boolean; comment?: string | null }) {
    return this.service.feedback(slug, me.sub, body);
  }
}
