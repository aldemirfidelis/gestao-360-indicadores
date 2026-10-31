import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDate, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { SITE_EVENT_TYPES, type SiteEventType } from '@g360/shared';

class SiteEventDto {
  @IsIn(SITE_EVENT_TYPES)
  type!: SiteEventType;

  /** Botão, seção ou tipo do formulário (nunca o que a pessoa digitou). */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  path?: string;

  /** Momento no navegador (ms desde 1970): os eventos chegam em lote. */
  @IsInt()
  at!: number;
}

/** Dados do início da visita: só são usados quando a visita é criada. */
class VisitContextDto {
  /** Página de entrada com a query (utm_*). */
  @IsString()
  @MaxLength(1000)
  entryPath!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  referrer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  screen?: string;

  @IsOptional()
  @IsString()
  @MaxLength(35)
  language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  timezone?: string;

  /** Tela de toque: separa o iPad "modo computador" de um Mac. */
  @IsOptional()
  @IsBoolean()
  touch?: boolean;

  /** navigator.webdriver: navegador controlado por automação (fica fora dos números). */
  @IsOptional()
  @IsBoolean()
  webdriver?: boolean;
}

/** Lote enviado pelo site e pela demonstração para /public/site-events. */
export class SiteEventsDto {
  @IsUUID()
  visitorId!: string;

  @IsUUID()
  visitId!: string;

  /** Relógio do navegador no envio: corrige a hora dos eventos quando o relógio dele está errado. */
  @IsInt()
  sentAt!: number;

  @ValidateNested()
  @Type(() => VisitContextDto)
  context!: VisitContextDto;

  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => SiteEventDto)
  events!: SiteEventDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  maxScrollPct?: number;

  /** Tempo com a aba visível, no site e na demonstração. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86_400_000)
  activeMs?: number;

  /** Parte do tempo visível passada dentro da demonstração. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86_400_000)
  demoMs?: number;
}

export class SitePeriodQuery {
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}

export const VISIT_STATUSES = ['contacted', 'demo_navigated', 'demo_entered', 'demo_clicked', 'no_demo', 'bounced'] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

export class SiteVisitsQuery extends SitePeriodQuery {
  /**
   * contacted = WhatsApp ou formulário; demo_navigated = abriu 2+ páginas da demo; demo_entered = entrou e
   * parou na primeira página; demo_clicked = clicou e a demo não abriu; no_demo = não clicou na demo
   * (inclui quem saiu sem interagir); bounced = saiu sem interagir.
   */
  @IsOptional()
  @IsIn(VISIT_STATUSES)
  status?: VisitStatus;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  region?: string;

  @IsOptional()
  @IsIn(['desktop', 'mobile', 'tablet'])
  device?: string;

  /** IP, cidade, campanha ou site de origem. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;

  /** Mostra também robôs e navegadores automatizados. */
  @IsOptional()
  @IsIn(['true', 'false'])
  bots?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
