import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { OrgNodesService } from './orgnodes.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { orgNodeCreateSchema } from '@g360/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthPayload } from '../auth/auth.types';

@Controller('orgnodes')
export class OrgNodesController {
  constructor(private readonly service: OrgNodesService) {}

  @Get()
  list(@CurrentUser() me: AuthPayload) {
    return this.service.listFlat(me.companyId);
  }

  @Get('tree')
  tree(@CurrentUser() me: AuthPayload) {
    return this.service.tree(me.companyId);
  }

  @Post()
  create(@Body(new ZodValidationPipe(orgNodeCreateSchema)) input: any) {
    return this.service.create(input);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() input: any) {
    return this.service.update(id, input);
  }

  @Patch(':id/move')
  move(@Param('id') id: string, @Body() body: { parentId: string | null }) {
    return this.service.move(id, body.parentId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
