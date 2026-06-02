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
import { PeriodsModule } from './modules/periods/periods.module';
import { ClosedMonthsModule } from './modules/closed-months/closed-months.module';
import { AiModule } from './modules/ai/ai.module';

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
    PeriodsModule,
    ClosedMonthsModule,
    AiModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
