import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly service: SearchService) {}

  @Get()
  global(@CurrentUser() me: AuthPayload, @Query('q') q = '', @Query('limit') limit?: string) {
    return this.service.global(me.companyId, q, limit ? parseInt(limit, 10) : 8);
  }
}
