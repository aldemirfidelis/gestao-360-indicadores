import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthPayload } from '../auth/auth.types';
import { InventoryService } from './inventory.service';
import {
  catalogImportSchema,
  cancellationSchema,
  stockAdjustmentSchema,
  stockItemCreateSchema,
  stockItemUpdateSchema,
  stockTransferSchema,
  warehouseCreateSchema,
  warehouseUpdateSchema,
  withdrawalCreateSchema,
  withdrawalDecisionSchema,
  withdrawalFulfillSchema,
} from './supplies.dto';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  @Get('dashboard')
  @RequirePermissions('estoque:view')
  dashboard(@CurrentUser() me: AuthPayload) { return this.service.dashboard(me); }

  @Get('warehouses')
  @RequirePermissions('estoque:view')
  warehouses(@CurrentUser() me: AuthPayload, @Query('includeInactive') includeInactive?: string) { return this.service.listWarehouses(me, includeInactive === 'true'); }

  @Post('warehouses')
  @RequirePermissions('estoque:manage')
  createWarehouse(@CurrentUser() me: AuthPayload, @Body(new ZodValidationPipe(warehouseCreateSchema)) body: any) { return this.service.createWarehouse(me, body); }

  @Patch('warehouses/:id')
  @RequirePermissions('estoque:manage')
  updateWarehouse(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body(new ZodValidationPipe(warehouseUpdateSchema)) body: any) { return this.service.updateWarehouse(me, id, body); }

  @Get('items')
  @RequirePermissions('estoque:view', 'compras:view')
  items(@CurrentUser() me: AuthPayload, @Query() query: any) { return this.service.listItems(me, query); }

  @Post('items')
  @RequirePermissions('estoque:manage')
  createItem(@CurrentUser() me: AuthPayload, @Body(new ZodValidationPipe(stockItemCreateSchema)) body: any) { return this.service.createItem(me, body); }

  @Patch('items/:id')
  @RequirePermissions('estoque:manage')
  updateItem(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body(new ZodValidationPipe(stockItemUpdateSchema)) body: any) { return this.service.updateItem(me, id, body); }

  @Get('balances')
  @RequirePermissions('estoque:view')
  balances(@CurrentUser() me: AuthPayload, @Query() query: any) { return this.service.listBalances(me, query); }

  @Get('movements')
  @RequirePermissions('estoque:view')
  movements(@CurrentUser() me: AuthPayload, @Query() query: any) { return this.service.listMovements(me, query); }

  @Post('movements/adjust')
  @RequirePermissions('estoque:adjust', 'estoque:manage')
  adjust(@CurrentUser() me: AuthPayload, @Body(new ZodValidationPipe(stockAdjustmentSchema)) body: any) { return this.service.adjustStock(me, body); }

  @Post('movements/transfer')
  @RequirePermissions('estoque:transfer', 'estoque:manage')
  transfer(@CurrentUser() me: AuthPayload, @Body(new ZodValidationPipe(stockTransferSchema)) body: any) { return this.service.transferStock(me, body); }

  @Get('withdrawals')
  @RequirePermissions('estoque:view', 'estoque:withdraw', 'estoque:operate')
  withdrawals(@CurrentUser() me: AuthPayload, @Query('scope') scope?: string) { return this.service.listWithdrawals(me, scope); }

  @Post('withdrawals')
  @RequirePermissions('estoque:withdraw', 'estoque:view')
  createWithdrawal(@CurrentUser() me: AuthPayload, @Body(new ZodValidationPipe(withdrawalCreateSchema)) body: any) { return this.service.createWithdrawal(me, body); }

  @Post('withdrawals/:id/approve')
  @RequirePermissions('estoque:approve', 'estoque:manage')
  approveWithdrawal(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body(new ZodValidationPipe(withdrawalDecisionSchema)) body: any) { return this.service.decideWithdrawal(me, id, 'APPROVED', body); }

  @Post('withdrawals/:id/reject')
  @RequirePermissions('estoque:approve', 'estoque:manage')
  rejectWithdrawal(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body(new ZodValidationPipe(withdrawalDecisionSchema)) body: any) { return this.service.decideWithdrawal(me, id, 'REJECTED', body); }

  @Post('withdrawals/:id/cancel')
  @RequirePermissions('estoque:withdraw', 'estoque:view')
  cancelWithdrawal(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body(new ZodValidationPipe(cancellationSchema)) body: any) { return this.service.cancelWithdrawal(me, id, body); }

  @Post('withdrawals/:id/fulfill')
  @RequirePermissions('estoque:operate', 'estoque:manage')
  fulfillWithdrawal(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body(new ZodValidationPipe(withdrawalFulfillSchema)) body: any) { return this.service.fulfillWithdrawal(me, id, body); }

  @Get('imports/catalog-template')
  @RequirePermissions('estoque:manage')
  async importTemplate(@Res() res: Response) {
    const file = await this.service.importTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=modelo-catalogo-suprimentos.xlsx');
    res.send(file);
  }

  @Post('imports/catalog')
  @RequirePermissions('estoque:manage')
  importCatalog(@CurrentUser() me: AuthPayload, @Body(new ZodValidationPipe(catalogImportSchema)) body: any) { return this.service.importCatalog(me, body); }
}
