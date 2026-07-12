import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthPayload } from '../auth/auth.types';
import { AdvancedSuppliesService } from './advanced-supplies.service';
import { inventoryCountCompleteSchema, inventoryCountCreateSchema, inventoryCountRecordSchema, measurementContestSchema, measurementCreateSchema, measurementDecisionSchema, serviceInvoiceCreateSchema, withdrawalPolicySchema } from './supplies.dto';

@Controller('supplies-advanced')
export class AdvancedSuppliesController {
  constructor(private readonly service: AdvancedSuppliesService) {}
  @Get('measurements') @RequirePermissions('compras:view', 'compras:buy', 'compras:approve') measurements(@CurrentUser() me: AuthPayload, @Query('status') status?: string) { return this.service.listMeasurements(me, status); }
  @Post('measurements') @RequirePermissions('compras:buy', 'compras:manage') createMeasurement(@CurrentUser() me: AuthPayload, @Body(new ZodValidationPipe(measurementCreateSchema)) body: any) { return this.service.createMeasurement(me, body); }
  @Post('measurements/:id/submit') @RequirePermissions('compras:buy', 'compras:manage') submitMeasurement(@CurrentUser() me: AuthPayload, @Param('id') id: string) { return this.service.submitMeasurement(me, id); }
  @Post('measurements/:id/approve') @RequirePermissions('compras:approve', 'compras:manage') approveMeasurement(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body(new ZodValidationPipe(measurementDecisionSchema)) body: any) { return this.service.approveMeasurement(me, id, body); }
  @Post('measurements/:id/contest') @RequirePermissions('compras:approve', 'compras:manage') contestMeasurement(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body(new ZodValidationPipe(measurementContestSchema)) body: any) { return this.service.contestMeasurement(me, id, body); }
  @Post('invoices/service') @RequirePermissions('compras:buy', 'compras:manage') serviceInvoice(@CurrentUser() me: AuthPayload, @Body(new ZodValidationPipe(serviceInvoiceCreateSchema)) body: any) { return this.service.createServiceInvoice(me, body); }
  @Get('inventory-counts') @RequirePermissions('estoque:view', 'estoque:operate') counts(@CurrentUser() me: AuthPayload) { return this.service.listCounts(me); }
  @Post('inventory-counts') @RequirePermissions('estoque:manage', 'estoque:adjust') createCount(@CurrentUser() me: AuthPayload, @Body(new ZodValidationPipe(inventoryCountCreateSchema)) body: any) { return this.service.createCount(me, body); }
  @Post('inventory-counts/:id/start') @RequirePermissions('estoque:operate', 'estoque:manage') startCount(@CurrentUser() me: AuthPayload, @Param('id') id: string) { return this.service.startCount(me, id); }
  @Post('inventory-counts/:id/record') @RequirePermissions('estoque:operate', 'estoque:manage') recordCount(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body(new ZodValidationPipe(inventoryCountRecordSchema)) body: any) { return this.service.recordCount(me, id, body); }
  @Post('inventory-counts/:id/complete') @RequirePermissions('estoque:adjust', 'estoque:manage') completeCount(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body(new ZodValidationPipe(inventoryCountCompleteSchema)) body: any) { return this.service.completeCount(me, id, body); }
  @Get('abc-curve') @RequirePermissions('estoque:view') abc(@CurrentUser() me: AuthPayload, @Query('warehouseId') warehouseId?: string) { return this.service.abcCurve(me, warehouseId); }
  @Get('qr/:token') @RequirePermissions('estoque:view') qr(@CurrentUser() me: AuthPayload, @Param('token') token: string) { return this.service.lookupQr(me, token); }
  @Get('withdrawal-policies') @RequirePermissions('estoque:view', 'estoque:manage') policies(@CurrentUser() me: AuthPayload) { return this.service.listPolicies(me); }
  @Post('withdrawal-policies') @RequirePermissions('estoque:manage') createPolicy(@CurrentUser() me: AuthPayload, @Body(new ZodValidationPipe(withdrawalPolicySchema)) body: any) { return this.service.createPolicy(me, body); }
}
