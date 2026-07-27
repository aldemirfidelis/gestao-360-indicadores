import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuthPayload } from '../auth/auth.types';
import { TrainingCatalogService } from './training-catalog.service';
import { TrainingDocumentService } from './training-document.service';
import { TrainingCertificatesService } from './training-certificates.service';
import { TrainingClassesService } from './training-classes.service';
import { TrainingEmployeeService } from './training-employee.service';
import { TrainingMatrixService } from './training-matrix.service';
import { TrainingQueryService } from './training-query.service';

/** Visão geral, matriz, pendências e histórico. */
@Controller('training')
export class TrainingController {
  constructor(
    private readonly query: TrainingQueryService,
    private readonly matrix: TrainingMatrixService,
  ) {}

  @Get('overview')
  @RequirePermissions('training:view')
  overview(@CurrentUser() me: AuthPayload) {
    return this.query.overview(me);
  }

  /** Matriz de treinamento e Pendências usam a mesma consulta, com filtros. */
  @Get('assignments')
  @RequirePermissions('training:view')
  assignments(@CurrentUser() me: AuthPayload, @Query() query: Record<string, string>) {
    return this.query.assignments(me, query);
  }

  @Get('assignments/:id')
  @RequirePermissions('training:view')
  assignmentDetail(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.query.assignmentDetail(me, id);
  }

  @Get('employees/:employeeId/history')
  @RequirePermissions('training:view')
  employeeHistory(@CurrentUser() me: AuthPayload, @Param('employeeId') employeeId: string) {
    return this.query.employeeHistory(me, employeeId);
  }

  /** Quem está autorizado (e quem está impedido) para uma atividade. */
  @Get('trainings/:trainingId/authorized')
  @RequirePermissions('training:view')
  authorized(@CurrentUser() me: AuthPayload, @Param('trainingId') trainingId: string) {
    return this.query.authorizedFor(me, trainingId);
  }

  /** Recalcula a matriz de um colaborador sob demanda. */
  @Post('employees/:employeeId/recompute')
  @RequirePermissions('training:manage')
  recompute(@CurrentUser() me: AuthPayload, @Param('employeeId') employeeId: string) {
    return this.matrix.recomputeEmployee(me.companyId, employeeId, { reason: 'MATRIX_CHANGED', actorUserId: me.sub });
  }
}

/** Catálogo: treinamentos, categorias e instrutores. */
@Controller('training/catalog')
export class TrainingCatalogController {
  constructor(private readonly catalog: TrainingCatalogService) {}

  @Get('categories')
  @RequirePermissions('training:view')
  categories(@CurrentUser() me: AuthPayload) {
    return this.catalog.categories(me.companyId);
  }

  @Post('categories')
  @RequirePermissions('training:manage')
  createCategory(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.catalog.createCategory(me, body ?? {});
  }

  @Get('instructors')
  @RequirePermissions('training:view')
  instructors(@CurrentUser() me: AuthPayload) {
    return this.catalog.instructors(me.companyId);
  }

  @Post('instructors')
  @RequirePermissions('training:manage')
  createInstructor(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.catalog.createInstructor(me, body ?? {});
  }

  @Get('trainings')
  @RequirePermissions('training:view')
  listTrainings(@CurrentUser() me: AuthPayload, @Query() query: Record<string, string>) {
    return this.catalog.listTrainings(me.companyId, query);
  }

  @Get('trainings/:id')
  @RequirePermissions('training:view')
  getTraining(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.catalog.getTraining(me.companyId, id);
  }

  @Post('trainings')
  @RequirePermissions('training:create')
  createTraining(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.catalog.createTraining(me, body ?? {});
  }

  @Patch('trainings/:id')
  @RequirePermissions('training:update')
  updateTraining(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.catalog.updateTraining(me, id, body ?? {});
  }

  @Delete('trainings/:id')
  @RequirePermissions('training:manage')
  archiveTraining(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.catalog.archiveTraining(me, id);
  }

  // ---------------- Exigências (matriz por cargo/área/pessoa) ----------------

  @Get('requirements')
  @RequirePermissions('training:view')
  listRequirements(@CurrentUser() me: AuthPayload, @Query() query: Record<string, string>) {
    return this.catalog.listRequirements(me.companyId, query);
  }

  @Post('requirements')
  @RequirePermissions('training:requirements')
  createRequirement(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.catalog.createRequirement(me, body ?? {});
  }

  @Patch('requirements/:id')
  @RequirePermissions('training:requirements')
  updateRequirement(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.catalog.updateRequirement(me, id, body ?? {});
  }

  @Delete('requirements/:id')
  @RequirePermissions('training:requirements')
  removeRequirement(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.catalog.removeRequirement(me, id);
  }
}

/** Turmas: agenda, participantes, presença e conclusão. */
@Controller('training/classes')
export class TrainingClassesController {
  constructor(private readonly classes: TrainingClassesService) {}

  @Get()
  @RequirePermissions('training:view')
  list(@CurrentUser() me: AuthPayload, @Query() query: Record<string, string>) {
    return this.classes.list(me.companyId, query);
  }

  @Get(':id')
  @RequirePermissions('training:view')
  detail(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.classes.detail(me.companyId, id);
  }

  @Post()
  @RequirePermissions('training:class:manage')
  create(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.classes.create(me, body ?? {});
  }

  @Patch(':id')
  @RequirePermissions('training:class:manage')
  update(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.classes.update(me, id, body ?? {});
  }

  /** Atalho do plano: incluir todos os pendentes do treinamento. */
  @Post(':id/participants/pending')
  @RequirePermissions('training:class:manage')
  addPending(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.classes.addPendingParticipants(me, id);
  }

  @Post(':id/participants')
  @RequirePermissions('training:class:manage')
  addParticipants(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.classes.addParticipants(me, id, Array.isArray(body?.employeeIds) ? body.employeeIds : []);
  }

  @Delete(':id/participants/:participantId')
  @RequirePermissions('training:class:manage')
  removeParticipant(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Param('participantId') participantId: string) {
    return this.classes.removeParticipant(me, id, participantId);
  }

  @Post(':id/attendance')
  @RequirePermissions('training:attendance')
  attendance(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.classes.setAttendance(me, id, Array.isArray(body?.entries) ? body.entries : []);
  }

  @Post(':id/close')
  @RequirePermissions('training:result')
  close(@CurrentUser() me: AuthPayload, @Param('id') id: string) {
    return this.classes.close(me, id);
  }

  @Post(':id/cancel')
  @RequirePermissions('training:class:manage')
  cancel(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    return this.classes.cancel(me, id, String(body?.reason ?? ''));
  }
}

/** Certificados e validação de comprovantes externos. */
@Controller('training/certificates')
export class TrainingCertificatesController {
  constructor(private readonly certificates: TrainingCertificatesService) {}

  @Get()
  @RequirePermissions('training:view')
  list(@CurrentUser() me: AuthPayload, @Query() query: Record<string, string>) {
    return this.certificates.list(me.companyId, query);
  }

  @Post()
  @RequirePermissions('training:certificate')
  create(@CurrentUser() me: AuthPayload, @Body() body: any) {
    return this.certificates.create(me, body ?? {});
  }

  @Post(':id/validate')
  @RequirePermissions('training:certificate:validate')
  validate(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body() body: any) {
    const action = body?.action === 'reject' ? 'reject' : 'approve';
    return this.certificates.decide(me, id, action, body?.note);
  }
}

/** Meus Treinamentos — visão do próprio colaborador. */
@Controller('training/me')
export class TrainingEmployeeController {
  constructor(private readonly employee: TrainingEmployeeService) {}

  @Get()
  @RequirePermissions('training:self')
  mine(@CurrentUser() me: AuthPayload) {
    return this.employee.myTrainings(me);
  }

  @Post('classes/:participantId/confirm')
  @RequirePermissions('training:self')
  confirm(@CurrentUser() me: AuthPayload, @Param('participantId') participantId: string) {
    return this.employee.confirmAttendance(me, participantId);
  }

  @Post('classes/:participantId/justify')
  @RequirePermissions('training:self')
  justify(@CurrentUser() me: AuthPayload, @Param('participantId') participantId: string, @Body() body: any) {
    return this.employee.justifyAbsence(me, participantId, String(body?.reason ?? ''));
  }
}

/**
 * Integração com o GED: o que a revisão de um documento exige de quem já foi
 * treinado, e quem ainda não está na versão atual.
 */
@Controller('training/documents')
export class TrainingDocumentController {
  constructor(private readonly documents: TrainingDocumentService) {}

  @Get(':documentId')
  @RequirePermissions('training:view', 'doc:view')
  linked(@CurrentUser() me: AuthPayload, @Param('documentId') documentId: string) {
    return this.documents.trainingsForDocument(me.companyId, documentId);
  }

  /** Quem ainda não foi treinado na revisão atual do documento. */
  @Get(':documentId/outdated')
  @RequirePermissions('training:view')
  outdated(@CurrentUser() me: AuthPayload, @Param('documentId') documentId: string) {
    return this.documents.outdatedForDocument(me.companyId, documentId);
  }

  /** O responsável decide o que a revisão exige (sobrepõe a ação padrão). */
  @Post(':documentId/revision')
  @RequirePermissions('training:requirements', 'training:manage')
  decide(@CurrentUser() me: AuthPayload, @Param('documentId') documentId: string, @Body() body: any) {
    return this.documents.decideRevision(me, documentId, body ?? {});
  }

  /** Ação padrão do treinamento para futuras revisões do documento. */
  @Patch('trainings/:trainingId/revision-action')
  @RequirePermissions('training:update', 'training:manage')
  setAction(@CurrentUser() me: AuthPayload, @Param('trainingId') trainingId: string, @Body() body: any) {
    return this.documents.setRevisionAction(me, trainingId, body?.action);
  }
}
