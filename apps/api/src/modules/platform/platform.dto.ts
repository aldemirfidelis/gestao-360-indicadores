import { IsBoolean, IsEmail, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, ValidateIf } from 'class-validator';
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
  // Subdomínio do tenant (empresa.gestao360.org) e domínio próprio (white-label).
  // Formato/unicidade/reservados validados no service.
  @IsOptional() @IsString() @MaxLength(63) slug?: string;
  @IsOptional() @IsString() @MaxLength(255) customDomain?: string;
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
  @IsOptional() @IsString() @MaxLength(63) slug?: string;
  @IsOptional() @IsString() @MaxLength(255) customDomain?: string;
}

export class SetCompanyStatusDto {
  @IsEnum(CompanyStatus)
  status!: CompanyStatus;
}

/** Troca a empresa ativa do Super Admin. `companyId: null` volta para a empresa de origem. */
export class SwitchCompanyDto {
  @IsOptional()
  @ValidateIf((o) => o.companyId !== null)
  @IsString()
  companyId?: string | null;
}
