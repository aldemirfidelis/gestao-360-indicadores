import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';
import { SupportTicketsService } from './support-tickets.service';

@Controller('support-tickets')
export class SupportTicketsController {
  constructor(private readonly service: SupportTicketsService) {}

  @Post()
  create(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.service.create(me, body);
  }

  @Get()
  list(
    @CurrentUser() me: AuthPayload,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('type') type?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.service.list(me, { q, status, priority, type, companyId });
  }

  @Get(':id')
  byId(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.getById(id, me);
  }

  @Post(':id/messages')
  addMessage(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.addMessage(id, me, body);
  }

  @Patch(':id')
  updateTicket(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.updateTicket(id, me, body);
  }
}
