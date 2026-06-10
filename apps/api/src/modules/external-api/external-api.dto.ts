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

// ----- Gestao de Premio: base elegivel + eventos (push direto do Apdata/folha) -----

export class ExternalPrizeEmployeeDto {
  @IsString() @MaxLength(40) registration!: string;
  @IsString() @MaxLength(200) name!: string;
  @IsOptional() @IsString() @MaxLength(20) cpf?: string; // mascarado ao persistir; nunca armazenado em claro
  @IsOptional() @IsString() @MaxLength(40) bond?: string;
  @IsOptional() @IsString() @MaxLength(120) branchRef?: string;
  @IsOptional() @IsString() @MaxLength(120) unitRef?: string;
  @IsOptional() @IsString() @MaxLength(120) positionRef?: string;
  @IsOptional() @IsString() @MaxLength(120) functionRef?: string;
  @IsOptional() @IsString() @MaxLength(120) areaRef?: string;
  @IsOptional() @IsString() @MaxLength(120) sectorRef?: string;
  @IsOptional() @IsString() @MaxLength(60) costCenterRef?: string;
  @IsOptional() @IsNumber() baseSalary?: number;
  @IsOptional() @IsString() @MaxLength(30) admissionDate?: string;
  @IsOptional() @IsString() @MaxLength(30) terminationDate?: string;
  @IsOptional() @IsString() @MaxLength(40) situation?: string;
  @IsOptional() @IsNumber() workedDays?: number;
}

export class ExternalPrizeEventDto {
  @IsString() @MaxLength(40) registration!: string;
  @IsString() @MaxLength(60) type!: string; // FALTA | ATESTADO | MEDIDA_DISCIPLINAR | SUSPENSAO | ACIDENTE | ...
  @IsOptional() @IsString() @MaxLength(30) date?: string;
  @IsOptional() @IsNumber() days?: number;
  @IsOptional() @IsNumber() value?: number;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
}

export class ExternalPrizeEligibleDto {
  @IsString() @MaxLength(40) programCode!: string;
  @IsNumber() year!: number;
  @IsNumber() month!: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => ExternalPrizeEmployeeDto)
  employees!: ExternalPrizeEmployeeDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ExternalPrizeEventDto)
  events?: ExternalPrizeEventDto[];
}

export class ExternalPrizeEventsDto {
  @IsString() @MaxLength(40) programCode!: string;
  @IsNumber() year!: number;
  @IsNumber() month!: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => ExternalPrizeEventDto)
  events!: ExternalPrizeEventDto[];
}
