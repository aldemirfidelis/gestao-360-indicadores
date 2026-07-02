import { Body, Controller, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { AssistantService, HelpRequest } from './assistant.service';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class HelpHistoryMessageDto {
  @IsIn(['user', 'assistant', 'model'])
  role!: 'user' | 'assistant' | 'model';

  @IsString()
  @MaxLength(4_000)
  content!: string;
}

export class HelpRequestDto implements HelpRequest {
  @IsString()
  @IsNotEmpty({ message: 'A mensagem não pode ser vazia.' })
  @MaxLength(2_000)
  message!: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  module?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  route?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  conversationId?: string;

  @IsArray()
  @IsOptional()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => HelpHistoryMessageDto)
  history?: HelpHistoryMessageDto[];
}

@Controller('assistant')
export class AssistantController {
  constructor(private readonly service: AssistantService) {}

  @Post('help')
  @RequirePermissions('ai:use')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async help(@CurrentUser() user: AuthPayload, @Body() body: HelpRequestDto) {
    return this.service.getHelpResponse(body, user);
  }
}
