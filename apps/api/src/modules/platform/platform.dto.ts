import { IsBoolean, IsEmail, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { CompanyStatus } from '@prisma/client';

export class CreateCompanyDto {
  @IsString()
  @MaxLength(180)
  name!: string;

  @IsOptional() @IsString() @MaxLength(180) tradeName?: string;
  @IsOptional() @IsString() @MaxLength(40) cnpj?: string;
  @IsOptional() @IsString() @MaxLength(500) logoUrl?: string;
  @IsOptional() @IsEmail() @MaxLength(180) email?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(240) addressLine?: string;
  @IsOptional() @IsString() @MaxLength(120) city?: string;
  @IsOptional() @IsString() @MaxLength(60) state?: string;
  @IsOptional() @IsString() @MaxLength(120) segment?: string;
  @IsOptional() @IsInt() @Min(1) maxUsers?: number;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsEnum(CompanyStatus) status?: CompanyStatus;
  @IsOptional() @IsBoolean() areaAccessEnabled?: boolean;
}

export class UpdateCompanyDto {
  @IsOptional() @IsString() @MaxLength(180) name?: string;
  @IsOptional() @IsString() @MaxLength(180) tradeName?: string;
  @IsOptional() @IsString() @MaxLength(40) cnpj?: string;
  @IsOptional() @IsString() @MaxLength(500) logoUrl?: string;
  @IsOptional() @IsEmail() @MaxLength(180) email?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(240) addressLine?: string;
  @IsOptional() @IsString() @MaxLength(120) city?: string;
  @IsOptional() @IsString() @MaxLength(60) state?: string;
  @IsOptional() @IsString() @MaxLength(120) segment?: string;
  @IsOptional() @IsInt() @Min(1) maxUsers?: number;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @IsEnum(CompanyStatus) status?: CompanyStatus;
  @IsOptional() @IsBoolean() areaAccessEnabled?: boolean;
}

export class SetCompanyStatusDto {
  @IsEnum(CompanyStatus)
  status!: CompanyStatus;
}
