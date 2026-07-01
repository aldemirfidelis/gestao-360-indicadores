import { IsArray, IsBoolean, IsInt, IsISO8601, IsOptional, IsString, MaxLength, Min } from 'class-validator';

// ---------------------------------------------------------------------------
// RoPA — Registro das Operações de Tratamento
// ---------------------------------------------------------------------------
export class UpsertProcessingRecordDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  area?: string;

  @IsString()
  @MaxLength(2000)
  purpose!: string;

  @IsString()
  @MaxLength(120)
  legalBasis!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dataSubjects?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dataCategories?: string[];

  @IsOptional()
  @IsBoolean()
  hasSensitiveData?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sharedWith?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  retentionPeriod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  securityMeasures?: string;

  @IsOptional()
  @IsBoolean()
  internationalTransfer?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  status?: string;
}

// ---------------------------------------------------------------------------
// Suboperadores / subprocessadores
// ---------------------------------------------------------------------------
export class UpsertSubprocessorDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsString()
  @MaxLength(200)
  service!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  country?: string;

  @IsOptional()
  @IsBoolean()
  internationalTransfer?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  transferSafeguard?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  contractRef?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

// ---------------------------------------------------------------------------
// Incidentes de dados pessoais
// ---------------------------------------------------------------------------
export class UpsertDataIncidentDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  severity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  status?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  affectedData?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  affectedSubjects?: number;

  @IsOptional()
  @IsISO8601()
  detectedAt?: string;

  @IsOptional()
  @IsISO8601()
  containedAt?: string;

  @IsOptional()
  @IsISO8601()
  resolvedAt?: string;

  @IsOptional()
  @IsBoolean()
  anpdNotified?: boolean;

  @IsOptional()
  @IsISO8601()
  anpdNotifiedAt?: string;

  @IsOptional()
  @IsBoolean()
  subjectsNotified?: boolean;

  @IsOptional()
  @IsISO8601()
  subjectsNotifiedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  measures?: string;

  @IsOptional()
  @IsString()
  responsibleUserId?: string;
}
