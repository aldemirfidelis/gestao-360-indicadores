import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

export class CreateDirectDto {
  @IsString()
  userId!: string;
}

export class SendMessageAttachmentDto {
  @IsString()
  @MaxLength(180)
  fileName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  mimeType?: string;

  @IsInt()
  @Min(1)
  @Max(5 * 1024 * 1024)
  sizeBytes!: number;

  @IsString()
  dataBase64!: string;
}

export class SendMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  body?: string;

  @IsOptional()
  @IsString()
  replyToId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => SendMessageAttachmentDto)
  attachments?: SendMessageAttachmentDto[];
}

export class EditMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;
}

export class ReactionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(16)
  emoji!: string;
}
