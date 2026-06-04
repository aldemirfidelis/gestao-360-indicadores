import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

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
import { MeetingsModule } from './modules/meetings/meetings.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuditModule } from './modules/audit/audit.module';
import { ImportsModule } from './modules/imports/imports.module';
import { ReportsModule } from './modules/reports/reports.module';
import { InsightsModule } from './modules/insights/insights.module';
import { TraceabilityModule } from './modules/traceability/traceability.module';
import { SearchModule } from './modules/search/search.module';
import { TreatmentsModule } from './modules/treatments/treatments.module';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
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
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { ExternalApiModule } from './modules/external-api/external-api.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
    MeetingsModule,
    NotificationsModule,
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
    IntegrationsModule,
    ExternalApiModule,
    PlatformModule,
    AccessModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
