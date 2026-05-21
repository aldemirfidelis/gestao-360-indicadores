import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

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
import { RelationshipMapModule } from './modules/relationship-map/relationship-map.module';
import { SearchModule } from './modules/search/search.module';
import { TreatmentsModule } from './modules/treatments/treatments.module';

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
    RelationshipMapModule,
    SearchModule,
    TreatmentsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
