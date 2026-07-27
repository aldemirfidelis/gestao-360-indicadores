import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { AuthPayload } from '../../auth/auth.types';
import { MediaLibraryService, type MediaUploadBody } from './media-library.service';

/** Biblioteca de Midias da Comunicacao Interna. */
@Controller('communication/media')
export class MediaLibraryController {
  constructor(private readonly service: MediaLibraryService) {}

  @Get()
  @RequirePermissions('communication:view')
  list(@CurrentUser() me: AuthPayload, @Query() query: Record<string, string>) {
    return this.service.list(me, query);
  }

  @Post()
  @RequirePermissions('communication:media', 'communication:manage')
  upload(@CurrentUser() me: AuthPayload, @Body() body: MediaUploadBody) {
    return this.service.upload(me, body);
  }

  @Post(':id/replace')
  @RequirePermissions('communication:media', 'communication:manage')
  replace(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: MediaUploadBody) {
    return this.service.replace(me, id, body);
  }

  @Patch(':id')
  @RequirePermissions('communication:media', 'communication:manage')
  update(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.service.update(me, id, body ?? {});
  }

  @Delete(':id')
  @RequirePermissions('communication:media', 'communication:manage')
  remove(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.service.remove(me, id);
  }
}
