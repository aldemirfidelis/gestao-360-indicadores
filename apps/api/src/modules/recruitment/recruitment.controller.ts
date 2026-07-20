import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { RecruitRequisitionService } from './recruit-requisition.service';
import { RecruitPostingService } from './recruit-posting.service';
import { RecruitApplicationService } from './recruit-application.service';
import { RecruitEvaluationService } from './recruit-evaluation.service';
import { RecruitOfferService } from './recruit-offer.service';
import { RecruitOccupationalHealthService } from './recruit-occupational-health.service';
import { RecruitAdmissionService } from './recruit-admission.service';
import { RecruitLgpdService } from './recruit-lgpd.service';
import { RecruitCommunicationService } from './recruit-communication.service';
import { RecruitAnalyticsService } from './recruit-analytics.service';
import { RecruitTalentPoolService } from './recruit-talent-pool.service';

/**
 * Recrutamento e Seleção (F1-F2). Rotas autenticadas /api/recruitment/*.
 * O portal público de carreiras é servido pelo CareersController (@Public).
 */
@Controller('recruitment')
export class RecruitmentController {
  constructor(
    private readonly requisitions: RecruitRequisitionService,
    private readonly postings: RecruitPostingService,
    private readonly applications: RecruitApplicationService,
    private readonly evaluations: RecruitEvaluationService,
    private readonly offers: RecruitOfferService,
    private readonly occupationalHealth: RecruitOccupationalHealthService,
    private readonly admissions: RecruitAdmissionService,
    private readonly lgpd: RecruitLgpdService,
    private readonly communication: RecruitCommunicationService,
    private readonly analytics: RecruitAnalyticsService,
    private readonly talentPool: RecruitTalentPoolService,
  ) {}

  // ------------------------------ analytics ------------------------------

  @Get('analytics/funnel')
  @RequirePermissions('recruit:view')
  getAnalyticsFunnel(@CurrentUser() me: AuthPayload, @Query('from') from?: string, @Query('to') to?: string) {
    return this.analytics.getFunnel(me, { from, to });
  }

  // ------------------------------ banco de talentos ------------------------------

  @Get('candidates')
  @RequirePermissions('recruit:view')
  searchCandidates(
    @CurrentUser() me: AuthPayload,
    @Query('q') q?: string,
    @Query('tag') tag?: string,
    @Query('onlyAvailable') onlyAvailable?: string,
  ) {
    return this.talentPool.search(me, { q, tag, onlyAvailable: onlyAvailable === 'true' });
  }

  @Get('candidates/tags')
  @RequirePermissions('recruit:view')
  listCandidateTags(@CurrentUser() me: AuthPayload) {
    return this.talentPool.listTags(me);
  }

  @Post('candidates/:id/tags')
  @RequirePermissions('recruit:manage')
  setCandidateTags(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.talentPool.setTags(me, id, body?.tags);
  }

  // ------------------------------ comunicação (templates de e-mail) ------------------------------

  @Get('email-templates')
  @RequirePermissions('recruit:manage')
  listEmailTemplates(@CurrentUser() me: AuthPayload) {
    return this.communication.listTemplates(me);
  }

  @Post('email-templates/:event')
  @RequirePermissions('recruit:manage')
  upsertEmailTemplate(@CurrentUser() me: AuthPayload, @Param('event') event: string, @Body() body: any) {
    return this.communication.upsertTemplate(me, event, body);
  }

  @Post('email-templates/:event/reset')
  @RequirePermissions('recruit:manage')
  resetEmailTemplate(@CurrentUser() me: AuthPayload, @Param('event') event: string) {
    return this.communication.resetTemplate(me, event);
  }

  // ------------------------------ pipelines ------------------------------

  @Get('pipelines')
  @RequirePermissions('recruit:view')
  listPipelines(@CurrentUser() me: AuthPayload) {
    return this.postings.listPipelines(me);
  }

  @Post('pipelines')
  @RequirePermissions('recruit:manage')
  createPipeline(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.postings.createPipeline(me, body);
  }

  // ------------------------------ vagas ------------------------------

  @Get('postings')
  @RequirePermissions('recruit:view')
  listPostings(@CurrentUser() me: AuthPayload, @Query('status') status?: string) {
    return this.postings.listPostings(me, status);
  }

  @Get('postings/:id')
  @RequirePermissions('recruit:view')
  getPosting(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.postings.getPosting(me, id);
  }

  @Get('postings/:id/applications')
  @RequirePermissions('recruit:view')
  listApplications(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.applications.listByPosting(me, id);
  }

  @Get('postings/:id/stages')
  @RequirePermissions('recruit:view')
  postingStages(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.applications.postingStages(me, id);
  }

  @Get('postings/:id/screening-questions')
  @RequirePermissions('recruit:view')
  listScreeningQuestions(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.evaluations.listScreeningQuestions(me, id);
  }

  @Post('postings/:id/screening-questions')
  @RequirePermissions('recruit:manage')
  saveScreeningQuestion(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.evaluations.saveScreeningQuestion(me, id, body);
  }

  @Post('screening-questions/:id/delete')
  @RequirePermissions('recruit:manage')
  deleteScreeningQuestion(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.evaluations.deleteScreeningQuestion(me, id);
  }

  @Get('postings/:id/scorecard')
  @RequirePermissions('recruit:view')
  listScorecard(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.evaluations.listScorecard(me, id);
  }

  @Post('postings/:id/scorecard')
  @RequirePermissions('recruit:manage')
  saveScorecardCriterion(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.evaluations.saveCriterion(me, id, body);
  }

  @Post('scorecard/:id/delete')
  @RequirePermissions('recruit:manage')
  deleteScorecardCriterion(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.evaluations.deleteCriterion(me, id);
  }

  @Get('application-documents/:id')
  @RequirePermissions('recruit:view')
  readApplicationDocument(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.applications.readApplicationDocument(me, id);
  }

  @Get('applications/:id')
  @RequirePermissions('recruit:view')
  getApplication(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.applications.getApplication(me, id);
  }

  @Post('applications/:id/move')
  @RequirePermissions('recruit:manage')
  moveApplication(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.applications.moveStage(me, id, String(body?.toStageId ?? ''));
  }

  @Post('applications/:id/reject')
  @RequirePermissions('recruit:manage')
  rejectApplication(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.applications.reject(me, id, body?.reason);
  }

  @Post('applications/:id/notes')
  @RequirePermissions('recruit:manage')
  addApplicationNote(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.applications.addNote(me, id, String(body?.note ?? ''));
  }

  @Get('applications/:id/evaluations')
  @RequirePermissions('recruit:view')
  listEvaluations(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.evaluations.listEvaluations(me, id);
  }

  @Post('applications/:id/evaluations')
  @RequirePermissions('recruit:manage')
  submitEvaluation(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.evaluations.submitEvaluation(me, id, body);
  }

  @Get('applications/:id/interviews')
  @RequirePermissions('recruit:view')
  listInterviews(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.evaluations.listInterviews(me, id);
  }

  @Post('applications/:id/interviews')
  @RequirePermissions('recruit:manage')
  scheduleInterview(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.evaluations.scheduleInterview(me, id, body);
  }

  @Post('interviews/:id/status')
  @RequirePermissions('recruit:manage')
  updateInterviewStatus(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.evaluations.updateInterviewStatus(me, id, String(body?.status ?? ''));
  }

  @Get('applications/:id/assessments')
  @RequirePermissions('recruit:view')
  listAssessments(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.evaluations.listAssessments(me, id);
  }

  @Post('applications/:id/assessments')
  @RequirePermissions('recruit:manage')
  saveAssessment(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.evaluations.saveAssessment(me, id, body);
  }

  @Get('ai-settings')
  @RequirePermissions('recruit:view')
  getAiSettings(@CurrentUser() me: AuthPayload) {
    return this.evaluations.getAiSettings(me);
  }

  @Post('ai-settings')
  @RequirePermissions('recruit:manage')
  updateAiSettings(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.evaluations.updateAiSettings(me, body);
  }

  @Post('applications/:id/ai-triage')
  @RequirePermissions('recruit:manage')
  runAiTriage(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.evaluations.runAiTriage(me, id);
  }

  @Get('applications/:id/offers')
  @RequirePermissions('recruit:view')
  listOffers(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.offers.listOffers(me, id);
  }

  @Post('applications/:id/offers')
  @RequirePermissions('recruit:manage')
  saveOffer(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.offers.saveOffer(me, id, body);
  }

  @Post('offers/:id/approve')
  @RequirePermissions('recruit:offer:approve', 'recruit:manage')
  approveOffer(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.offers.approveOffer(me, id, body);
  }

  @Post('offers/:id/send')
  @RequirePermissions('recruit:manage')
  sendOffer(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.offers.sendOffer(me, id);
  }

  @Post('offers/:id/cancel')
  @RequirePermissions('recruit:manage')
  cancelOffer(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.offers.cancelOffer(me, id, body);
  }

  @Get('applications/:id/pre-admissions')
  @RequirePermissions('recruit:view')
  listPreAdmissions(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.offers.listPreAdmissions(me, id);
  }

  @Post('applications/:id/pre-admissions')
  @RequirePermissions('recruit:prehire', 'recruit:manage')
  startPreAdmission(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.offers.startPreAdmission(me, id, body);
  }

  @Post('pre-admissions/:id/documents')
  @RequirePermissions('recruit:prehire', 'recruit:manage')
  addPreAdmissionDocument(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.offers.addDocumentRequirement(me, id, body);
  }

  @Post('pre-admission-documents/:id/review')
  @RequirePermissions('recruit:prehire', 'recruit:manage')
  reviewPreAdmissionDocument(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.offers.reviewDocument(me, id, body);
  }

  @Get('applications/:id/occupational-exams')
  @RequirePermissions('recruit:view')
  listApplicationOccupationalExams(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.occupationalHealth.listForApplication(me, id);
  }

  @Post('applications/:id/occupational-exams')
  @RequirePermissions('recruit:prehire', 'recruit:manage')
  requestAso(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.occupationalHealth.requestAso(me, id, body);
  }

  @Get('occupational-exams')
  @RequirePermissions('saude:occupational')
  listOccupationalHealthQueue(@CurrentUser() me: AuthPayload, @Query('status') status?: string) {
    return this.occupationalHealth.listHealthQueue(me, { status });
  }

  @Get('occupational-exams/:id/medical')
  @RequirePermissions('saude:occupational')
  getOccupationalMedicalRecord(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.occupationalHealth.getMedicalRecord(me, id);
  }

  @Post('occupational-exams/:id/schedule')
  @RequirePermissions('saude:occupational')
  scheduleAso(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.occupationalHealth.scheduleAso(me, id, body);
  }

  @Post('occupational-exams/:id/result')
  @RequirePermissions('saude:occupational')
  recordAsoResult(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.occupationalHealth.recordAsoResult(me, id, body);
  }

  @Post('occupational-exams/:id/cancel')
  @RequirePermissions('recruit:prehire', 'recruit:manage', 'saude:occupational')
  cancelAso(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.occupationalHealth.cancelAso(me, id, body);
  }

  @Get('applications/:id/admission')
  @RequirePermissions('recruit:view')
  getAdmission(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.admissions.getAdmission(me, id);
  }

  @Post('applications/:id/admission/authorize')
  @RequirePermissions('recruit:admit', 'recruit:manage')
  authorizeAdmission(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.admissions.authorizeAdmission(me, id, body);
  }

  @Post('probation-reviews/:id/complete')
  @RequirePermissions('recruit:admit', 'recruit:manage')
  completeProbationReview(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.admissions.completeProbationReview(me, id, body);
  }

  // ------------------------------ LGPD (direitos do titular) ------------------------------

  @Get('data-requests')
  @RequirePermissions('recruit:lgpd', 'recruit:manage')
  listDataRequests(@CurrentUser() me: AuthPayload, @Query('status') status?: string, @Query('type') type?: string) {
    return this.lgpd.listRequests(me, { status, type });
  }

  @Get('data-requests/:id')
  @RequirePermissions('recruit:lgpd', 'recruit:manage')
  getDataRequest(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.lgpd.getRequest(me, id);
  }

  @Post('data-requests/:id/resolve')
  @RequirePermissions('recruit:lgpd', 'recruit:manage')
  resolveDataRequest(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.lgpd.resolveRequest(me, id, body);
  }

  @Get('candidates/:id/data-export')
  @RequirePermissions('recruit:lgpd', 'recruit:manage')
  exportCandidateData(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.lgpd.exportCandidateData(me, id);
  }

  @Post('requisitions/:id/posting')
  @RequirePermissions('recruit:manage')
  createPosting(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.postings.createFromRequisition(me, id);
  }

  @Post('postings/:id')
  @RequirePermissions('recruit:manage')
  updatePosting(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.postings.updatePosting(me, id, body);
  }

  @Post('postings/:id/publish')
  @RequirePermissions('recruit:manage')
  publishPosting(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.postings.publish(me, id);
  }

  @Post('postings/:id/status')
  @RequirePermissions('recruit:manage')
  setPostingStatus(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.postings.setStatus(me, id, String(body?.status ?? ''));
  }

  @Get('requisitions')
  @RequirePermissions('recruit:view')
  list(@CurrentUser() me: AuthPayload, @Query('status') status?: string, @Query('orgNodeId') orgNodeId?: string) {
    return this.requisitions.list(me, { status, orgNodeId });
  }

  @Get('requisitions/:id')
  @RequirePermissions('recruit:view')
  get(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.requisitions.get(me, id);
  }

  @Get('requisitions/:id/gate')
  @RequirePermissions('recruit:view')
  gate(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.requisitions.evaluateGate(me, id);
  }

  @Post('requisitions')
  @RequirePermissions('recruit:requisition:create')
  create(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.requisitions.create(me, body);
  }

  @Post('requisitions/:id/submit')
  @RequirePermissions('recruit:requisition:create')
  submit(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.requisitions.submit(me, id);
  }

  @Post('requisitions/:id/decide')
  @RequirePermissions('recruit:requisition:approve')
  decide(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.requisitions.decide(me, id, body);
  }

  @Post('requisitions/:id/gate-exception')
  @RequirePermissions('recruit:requisition:approve')
  gateException(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.requisitions.addGateException(me, id, body);
  }

  @Post('requisitions/:id/reassign-approver')
  @RequirePermissions('recruit:manage')
  reassignApprover(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.requisitions.reassignApprover(me, id, body);
  }

  @Post('requisitions/:id/send-to-recruitment')
  @RequirePermissions('recruit:requisition:approve')
  sendToRecruitment(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.requisitions.sendToRecruitment(me, id);
  }

  @Post('requisitions/:id/cancel')
  @RequirePermissions('recruit:requisition:create')
  cancel(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.requisitions.cancel(me, id, body);
  }

  // ------------------------------ mobilidade interna (self-service, qualquer colaborador logado) ------------------------------

  @Get('internal-postings')
  listInternalPostings(@CurrentUser() me: AuthPayload) {
    return this.postings.listInternalPostings(me);
  }

  @Get('internal-postings/my-applications')
  listMyInternalApplications(@CurrentUser() me: AuthPayload) {
    return this.applications.listMyInternalApplications(me);
  }

  @Get('internal-postings/:id')
  getInternalPosting(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.postings.getInternalPosting(me, id);
  }

  @Post('internal-postings/:id/apply')
  applyInternal(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.applications.applyInternal(me, id, body);
  }
}
