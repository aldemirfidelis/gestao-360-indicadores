import { IsArray, IsNumber, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ExternalResultItemDto {
  @IsString() @MaxLength(80) indicatorCode!: string;
  @IsString() @MaxLength(20) periodRef!: string; // YYYY-MM, YYYY, ...
  @IsNumber() value!: number;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class ExternalResultsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExternalResultItemDto)
  items!: ExternalResultItemDto[];
}
