import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { loggerParams } from './common/logging/logger.config';
import { LogContextInterceptor } from './common/logging/log-context.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { OrgNodesModule } from './modules/orgnodes/orgnodes.module';
import { IndicatorsModule } from './modules/indicators/indicators.module';
import { ResultsModule } from './modules/results/results.module';
import { DeviationsModule } from './modules/deviations/deviations.module';
import { ActionsModule } from './modules/actions/actions.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { HealthModule } from './modules/health/health.module';
import { StrategyModule } from './modules/strategy/strategy.module';
import { OkrsModule } from './modules/okrs/okrs.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { RisksModule } from './modules/risks/risks.module';
import { NonConformitiesModule } from './modules/nonconformities/nonconformities.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { AuditsModule } from './modules/audits/audits.module';
import { ProcessesModule } from './modules/processes/processes.module';
import { FoodSafetyModule } from './modules/food-safety/food-safety.module';
import { AssetSecurityModule } from './modules/asset-security/asset-security.module';
import { FormsModule } from './modules/forms/forms.module';
import { MeetingsModule } from './modules/meetings/meetings.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PushModule } from './modules/push/push.module';
import { AuditModule } from './modules/audit/audit.module';
import { ImportsModule } from './modules/imports/imports.module';
import { ReportsModule } from './modules/reports/reports.module';
import { InsightsModule } from './modules/insights/insights.module';
import { TraceabilityModule } from './modules/traceability/traceability.module';
import { SearchModule } from './modules/search/search.module';
import { TreatmentsModule } from './modules/treatments/treatments.module';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { HttpMetricsInterceptor } from './common/interceptors/http-metrics.interceptor';
import { AdminModule } from './modules/admin/admin.module';
import { DatabaseAdminModule } from './modules/database-admin/database-admin.module';
import { PortalAdminModule } from './modules/portal-admin/portal-admin.module';
import { PeriodsModule } from './modules/periods/periods.module';
import { ClosedMonthsModule } from './modules/closed-months/closed-months.module';
import { AiModule } from './modules/ai/ai.module';
import { CommunicationModule } from './modules/communication/communication.module';
import { PlatformModule } from './modules/platform/platform.module';
import { AccessModule } from './modules/access/access.module';
import { HelpModule } from './modules/help/help.module';
import { SupportTicketsModule } from './modules/support-tickets/support-tickets.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { ExternalApiModule } from './modules/external-api/external-api.module';
import { PlatformAdminGlobalModule } from './modules/platform-admin/platform-admin.module';
import { Vision360Module } from './modules/vision360/vision360.module';
import { AutomationsModule } from './modules/automations/automations.module';
import { MyDayModule } from './modules/my-day/my-day.module';
import { WorkItemEventsModule } from './modules/my-day/work-item-event-bus';
import { PrizeModule } from './modules/prize/prize.module';
import { CompensationModule } from './modules/compensation/compensation.module';
import { MonthlyResultsModule } from './modules/monthly-results/monthly-results.module';
import { StorageModule } from './storage/storage.module';
import { PublicModule } from './modules/public/public.module';
import { JobsModule } from './jobs/jobs.module';
import { workersEnabled } from './jobs/jobs.constants';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot(loggerParams),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 200 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    CompaniesModule,
    OrgNodesModule,
    IndicatorsModule,
    ResultsModule,
    DeviationsModule,
    ActionsModule,
    DashboardModule,
    HealthModule,
    StrategyModule,
    OkrsModule,
    ProjectsModule,
    RisksModule,
    NonConformitiesModule,
    DocumentsModule,
    AuditsModule,
    ProcessesModule,
    FoodSafetyModule,
    AssetSecurityModule,
    FormsModule,
    MeetingsModule,
    NotificationsModule,
    PushModule,
    AuditModule,
    ImportsModule,
    ReportsModule,
    InsightsModule,
    TraceabilityModule,
    SearchModule,
    TreatmentsModule,
    AdminModule,
    DatabaseAdminModule,
    PortalAdminModule,
    PeriodsModule,
    ClosedMonthsModule,
    AiModule,
    CommunicationModule,
    HelpModule,
    SupportTicketsModule,
    IntegrationsModule,
    ExternalApiModule,
    PlatformModule,
    PlatformAdminGlobalModule,
    AccessModule,
    WorkItemEventsModule,
    Vision360Module,
    AutomationsModule,
    MyDayModule,
    PrizeModule,
    CompensationModule,
    MonthlyResultsModule,
    StorageModule,
    PublicModule,
    // Workers BullMQ: importados apenas quando WORKERS_ENABLED=true (sem Redis no boot padrão).
    ...(workersEnabled() ? [JobsModule] : []),
  ],
  providers: [
    // Filtro global de exceção via DI (injeta o logger estruturado).
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Métricas (item 20) primeiro = mede o tempo total da request (envolve a auditoria).
    { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor },
    // Anexa userId/companyId ao contexto do logger (após os guards resolverem req.user).
    { provide: APP_INTERCEPTOR, useClass: LogContextInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
