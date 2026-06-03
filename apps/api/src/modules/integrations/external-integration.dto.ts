import { IsArray, IsBoolean, IsEnum, IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { IntegrationAuthType, IntegrationDirection, IntegrationProvider } from '@prisma/client';

export class CreateExternalIntegrationDto {
  @IsString() @MaxLength(180) name!: string;
  @IsEnum(IntegrationProvider) provider!: IntegrationProvider;
  @IsEnum(IntegrationDirection) direction!: IntegrationDirection;
  @IsEnum(IntegrationAuthType) authType!: IntegrationAuthType;
  @IsOptional() @IsString() @MaxLength(500) baseUrl?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
  /** Credenciais (cifradas no servidor; nunca retornam). */
  @IsOptional() @IsObject() credentials?: Record<string, unknown>;
  /** endpoints/headers/mapeamento. */
  @IsOptional() @IsObject() config?: Record<string, unknown>;
}

export class UpdateExternalIntegrationDto {
  @IsOptional() @IsString() @MaxLength(180) name?: string;
  @IsOptional() @IsEnum(IntegrationDirection) direction?: IntegrationDirection;
  @IsOptional() @IsEnum(IntegrationAuthType) authType?: IntegrationAuthType;
  @IsOptional() @IsString() @MaxLength(500) baseUrl?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsObject() credentials?: Record<string, unknown>;
  @IsOptional() @IsObject() config?: Record<string, unknown>;
}

export class RunIntegrationDto {
  @IsIn(['push:indicators', 'push:results', 'pull:results']) operation!: string;
}

export class CreateApiKeyDto {
  @IsString() @MaxLength(120) name!: string;
  @IsArray() @IsString({ each: true }) scopes!: string[];
  @IsOptional() @IsString() expiresAt?: string;
}
