import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PresenceStatus } from '@prisma/client';

const MANUAL_STATUSES: PresenceStatus[] = [
  PresenceStatus.ONLINE,
  PresenceStatus.AWAY,
  PresenceStatus.BUSY,
  PresenceStatus.DND,
  PresenceStatus.OFFLINE, // OFFLINE => limpa o status manual
];

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  customStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatarUrl?: string;
}

export class SetStatusDto {
  @IsIn(MANUAL_STATUSES)
  status!: PresenceStatus;
}

export class UpdatePreferencesDto {
  @IsOptional()
  @IsBoolean()
  browserPush?: boolean;

  @IsOptional()
  @IsBoolean()
  emailDigest?: boolean;

  @IsOptional()
  @IsBoolean()
  muteMessages?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  quietHoursStart?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  quietHoursEnd?: string;
}
