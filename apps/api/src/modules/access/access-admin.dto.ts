import { IsBoolean, IsEnum, IsIn, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { AreaAssignmentType, VisibilityEffect, VisibilityLevel } from '@prisma/client';

// Módulos cobertos pela matriz de visibilidade.
export const ACCESS_MODULES = [
  'indicators',
  'results',
  'action_plans',
  'deviations',
  'strategy',
  'meetings',
  'projects',
  'reports',
] as const;

export class UpsertMatrixRuleDto {
  @IsString() sourceAreaId!: string;
  @IsString() targetAreaId!: string;
  @IsString() @MaxLength(40) moduleKey!: string; // módulo ou "*"
  @IsOptional() @IsEnum(VisibilityLevel) visibilityLevel?: VisibilityLevel;
  @IsOptional() @IsBoolean() canView?: boolean;
  @IsOptional() @IsBoolean() canCreate?: boolean;
  @IsOptional() @IsBoolean() canEdit?: boolean;
  @IsOptional() @IsBoolean() canDelete?: boolean;
  @IsOptional() @IsBoolean() canApprove?: boolean;
  @IsOptional() @IsBoolean() canExport?: boolean;
}

export class AddAssignmentDto {
  @IsString() orgNodeId!: string;
  @IsOptional() @IsEnum(AreaAssignmentType) assignmentType?: AreaAssignmentType;
  @IsOptional() @IsISO8601() validUntil?: string;
}

export class SetPrimaryAreaDto {
  @IsString() orgNodeId!: string;
}

export class CreateExceptionDto {
  @IsString() userId!: string;
  @IsString() targetAreaId!: string;
  @IsString() @MaxLength(40) moduleKey!: string;
  @IsIn(['ALLOW', 'DENY']) effect!: VisibilityEffect;
  @IsOptional() @IsISO8601() validUntil?: string;
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}
