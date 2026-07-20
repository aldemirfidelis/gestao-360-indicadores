import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { RecruitCareersService } from './recruit-careers.service';
import { RecruitCandidateAuthService } from './recruit-candidate-auth.service';
import { RecruitApplicationService } from './recruit-application.service';
import { RecruitEvaluationService } from './recruit-evaluation.service';
import { RecruitOfferService } from './recruit-offer.service';
import { CandidateGuard } from './candidate.guard';
import { CurrentCandidate } from './current-candidate.decorator';
import type { CandidateContext } from './candidate.guard';

/**
 * Portal público de carreiras (F2) — SEM autenticação (@Public). A empresa é
 * resolvida pelo host (subdomínio empresa.gestao360.org / domínio próprio) ou
 * por `?empresa={slug}` como fallback enquanto o DNS curinga não estiver ativo.
 * Só expõe campos públicos das vagas publicadas.
 */
@Controller('careers')
export class CareersController {
  constructor(
    private readonly careers: RecruitCareersService,
    private readonly candidateAuth: RecruitCandidateAuthService,
    private readonly applications: RecruitApplicationService,
    private readonly evaluations: RecruitEvaluationService,
    private readonly offers: RecruitOfferService,
  ) {}

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

  @Public()
  @Get('vacancies/:slug/screening-questions')
  screeningQuestions(@Param('slug') slug: string, @Headers('host') host?: string, @Query('empresa') empresa?: string) {
    return this.evaluations.publicQuestions(slug, host, empresa);
  }

  // ------------------------------ candidato ------------------------------

  // Conta GLOBAL do portal de vagas: login/cadastro NÃO dependem de empresa.
  @Public()
  @Post('candidates/register')
  register(@Body() body: any) {
    return this.candidateAuth.register(body);
  }

  @Public()
  @Post('candidates/request-code')
  requestCode(@Body() body: any) {
    return this.candidateAuth.requestOtp(body);
  }

  @Public()
  @Post('candidates/login')
  login(@Body() body: any) {
    return this.candidateAuth.login(body);
  }

  @Public()
  @Post('candidates/forgot-password')
  forgotPassword(@Body() body: any) {
    return this.candidateAuth.requestPasswordReset(body);
  }

  @Public()
  @Post('candidates/reset-password')
  resetPassword(@Body() body: any) {
    return this.candidateAuth.resetPassword(body);
  }

  @Public()
  @UseGuards(CandidateGuard)
  @Get('candidate/me')
  me(@CurrentCandidate() candidate: CandidateContext) {
    return this.candidateAuth.me(candidate.id);
  }

  @Public()
  @UseGuards(CandidateGuard)
  @Patch('candidate/me')
  updateProfile(@CurrentCandidate() candidate: CandidateContext, @Body() body: any) {
    return this.candidateAuth.updateProfile(candidate.id, body);
  }

  @Public()
  @UseGuards(CandidateGuard)
  @Post('vacancies/:slug/apply')
  apply(
    @CurrentCandidate() candidate: CandidateContext,
    @Param('slug') slug: string,
    @Headers('host') host: string | undefined,
    @Query('empresa') empresa: string | undefined,
    @Body() body: any,
    @Req() req: { ip?: string; headers: Record<string, string | string[] | undefined> },
  ) {
    return this.applications.apply(candidate, slug, empresa, host, body, {
      ip: req.ip,
      userAgent: Array.isArray(req.headers['user-agent']) ? req.headers['user-agent'][0] : req.headers['user-agent'],
    });
  }

  @Public()
  @UseGuards(CandidateGuard)
  @Get('candidate/applications')
  myApplications(@CurrentCandidate() candidate: CandidateContext) {
    return this.applications.listMine(candidate);
  }

  @Public()
  @UseGuards(CandidateGuard)
  @Post('candidate/applications/:id/withdraw')
  withdraw(@CurrentCandidate() candidate: CandidateContext, @Param('id') id: string) {
    return this.applications.withdraw(candidate, id);
  }

  @Public()
  @UseGuards(CandidateGuard)
  @Post('candidate/documents')
  uploadDocument(@CurrentCandidate() candidate: CandidateContext, @Body() body: any) {
    return this.applications.uploadDocument(candidate, body);
  }

  @Public()
  @UseGuards(CandidateGuard)
  @Get('candidate/documents')
  myDocuments(@CurrentCandidate() candidate: CandidateContext) {
    return this.applications.listMyDocuments(candidate);
  }

  @Public()
  @UseGuards(CandidateGuard)
  @Get('candidate/documents/:id')
  readMyDocument(@CurrentCandidate() candidate: CandidateContext, @Param('id') id: string) {
    return this.applications.readMyDocument(candidate, id);
  }

  @Public()
  @UseGuards(CandidateGuard)
  @Delete('candidate/documents/:id')
  deleteMyDocument(@CurrentCandidate() candidate: CandidateContext, @Param('id') id: string) {
    return this.applications.deleteMyDocument(candidate, id);
  }

  @Public()
  @UseGuards(CandidateGuard)
  @Get('candidate/data-requests')
  myDataRequests(@CurrentCandidate() candidate: CandidateContext) {
    return this.applications.listMyDataRequests(candidate);
  }

  @Public()
  @UseGuards(CandidateGuard)
  @Post('candidate/data-requests')
  createDataRequest(@CurrentCandidate() candidate: CandidateContext, @Body() body: any) {
    return this.applications.createDataRequest(candidate, body);
  }

  @Public()
  @UseGuards(CandidateGuard)
  @Get('candidate/offers')
  myOffers(@CurrentCandidate() candidate: CandidateContext) {
    return this.offers.listMyOffers(candidate);
  }

  @Public()
  @UseGuards(CandidateGuard)
  @Post('candidate/offers/:id/decision')
  decideOffer(@CurrentCandidate() candidate: CandidateContext, @Param('id') id: string, @Body() body: any) {
    return this.offers.decideMyOffer(candidate, id, body);
  }

  @Public()
  @UseGuards(CandidateGuard)
  @Get('candidate/pre-admissions')
  myPreAdmissions(@CurrentCandidate() candidate: CandidateContext) {
    return this.offers.listMyPreAdmissions(candidate);
  }

  @Public()
  @UseGuards(CandidateGuard)
  @Post('candidate/pre-admission-documents/:id/submit')
  submitPreAdmissionDocument(@CurrentCandidate() candidate: CandidateContext, @Param('id') id: string, @Body() body: any) {
    return this.offers.submitMyPreAdmissionDocument(candidate, id, body);
  }
}
