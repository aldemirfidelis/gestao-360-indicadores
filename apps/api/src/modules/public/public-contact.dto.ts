import {
  Equals,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export const PUBLIC_CONTACT_REQUEST_TYPES = [
  'Comercial',
  'Suporte',
  'Suporte técnico',
  'Dúvida de acesso',
  'SAC',
  'Demonstração',
  'Trial de 30 dias',
  'Parceria',
  'LGPD e privacidade',
  'Outros',
] as const;

export type PublicContactRequestType = (typeof PUBLIC_CONTACT_REQUEST_TYPES)[number];

export class PublicContactDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(180)
  company!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  role?: string;

  @IsEmail()
  @MaxLength(180)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsString()
  @IsIn(PUBLIC_CONTACT_REQUEST_TYPES)
  requestType!: PublicContactRequestType;

  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  message!: string;

  @IsString()
  @Equals('accepted')
  privacy!: 'accepted';

  /** Campo-isca antispam. Uma submissão humana deve deixá-lo vazio. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
