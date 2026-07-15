import { Controller, Get, Headers, Param, Query } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { RecruitCareersService } from './recruit-careers.service';

/**
 * Portal público de carreiras (F2) — SEM autenticação (@Public). A empresa é
 * resolvida pelo host (subdomínio empresa.gestao360.org / domínio próprio) ou
 * por `?empresa={slug}` como fallback enquanto o DNS curinga não estiver ativo.
 * Só expõe campos públicos das vagas publicadas.
 */
@Controller('careers')
export class CareersController {
  constructor(private readonly careers: RecruitCareersService) {}

  @Public()
  @Get('company')
  company(@Headers('host') host?: string, @Query('empresa') empresa?: string) {
    return this.careers.companyInfo(host, empresa);
  }

  @Public()
  @Get('vacancies')
  vacancies(
    @Headers('host') host?: string,
    @Query('empresa') empresa?: string,
    @Query('q') q?: string,
    @Query('city') city?: string,
    @Query('workMode') workMode?: string,
  ) {
    return this.careers.listVacancies(host, empresa, { q, city, workMode });
  }

  @Public()
  @Get('vacancies/:slug')
  vacancy(@Param('slug') slug: string, @Headers('host') host?: string, @Query('empresa') empresa?: string) {
    return this.careers.getVacancy(slug, host, empresa);
  }
}
