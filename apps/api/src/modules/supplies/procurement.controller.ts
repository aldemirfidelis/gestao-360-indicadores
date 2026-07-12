import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthPayload } from '../auth/auth.types';
import { ProcurementService } from './procurement.service';
import {
  approvalDecisionSchema,
  approvalRuleCreateSchema,
  approvalRuleUpdateSchema,
  purchaseOrderCreateSchema,
  purchaseReceiptSchema,
  rejectionDecisionSchema,
  requisitionCreateSchema,
  requisitionRejectSchema,
  requisitionUpdateSchema,
  supplierCreateSchema,
  supplierUpdateSchema,
  cancellationSchema,
  invoiceReturnSchema,
  materialInvoiceCreateSchema,
  quotationAwardSchema,
  quotationCreateSchema,
  supplierQuoteCreateSchema,
} from './supplies.dto';

@Controller('procurement')
export class ProcurementController {
  constructor(private readonly service: ProcurementService) {}

  @Get('dashboard')
  @RequirePermissions('compras:view', 'compras:buy', 'compras:approve', 'compras:manage')
  dashboard(@CurrentUser() me: AuthPayload) { return this.service.dashboard(me); }

  @Get('options')
  @RequirePermissions('compras:view', 'compras:buy', 'compras:approve', 'compras:manage', 'estoque:view')
  options(@CurrentUser() me: AuthPayload) { return this.service.options(me); }

  @Get('suppliers')
  @RequirePermissions('compras:view')
  suppliers(@CurrentUser() me: AuthPayload, @Query('includeInactive') includeInactive?: string) { return this.service.listSuppliers(me, includeInactive === 'true'); }

  @Post('suppliers')
  @RequirePermissions('compras:manage')
  createSupplier(@CurrentUser() me: AuthPayload, @Body(new ZodValidationPipe(supplierCreateSchema)) body: any) { return this.service.createSupplier(me, body); }

  @Patch('suppliers/:id')
  @RequirePermissions('compras:manage')
  updateSupplier(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body(new ZodValidationPipe(supplierUpdateSchema)) body: any) { return this.service.updateSupplier(me, id, body); }

  @Get('approval-rules')
  @RequirePermissions('compras:view', 'compras:approve', 'compras:manage')
  approvalRules(@CurrentUser() me: AuthPayload) { return this.service.listApprovalRules(me); }

  @Post('approval-rules')
  @RequirePermissions('compras:manage')
  createApprovalRule(@CurrentUser() me: AuthPayload, @Body(new ZodValidationPipe(approvalRuleCreateSchema)) body: any) { return this.service.createApprovalRule(me, body); }

  @Patch('approval-rules/:id')
  @RequirePermissions('compras:manage')
  updateApprovalRule(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body(new ZodValidationPipe(approvalRuleUpdateSchema)) body: any) { return this.service.updateApprovalRule(me, id, body); }

  @Get('requisitions')
  @RequirePermissions('compras:view', 'compras:request', 'compras:buy')
  requisitions(@CurrentUser() me: AuthPayload, @Query() query: any) { return this.service.listRequisitions(me, query); }

  @Post('requisitions')
  @RequirePermissions('compras:request', 'compras:view')
  createRequisition(@CurrentUser() me: AuthPayload, @Body(new ZodValidationPipe(requisitionCreateSchema)) body: any) { return this.service.createRequisition(me, body); }

  @Patch('requisitions/:id')
  @RequirePermissions('compras:request', 'compras:view')
  updateRequisition(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body(new ZodValidationPipe(requisitionUpdateSchema)) body: any) { return this.service.updateRequisition(me, id, body); }

  @Post('requisitions/:id/submit')
  @RequirePermissions('compras:request', 'compras:view')
  submitRequisition(@CurrentUser() me: AuthPayload, @Param('id') id: string) { return this.service.submitRequisition(me, id); }

  @Post('requisitions/:id/claim')
  @RequirePermissions('compras:buy', 'compras:manage')
  claimRequisition(@CurrentUser() me: AuthPayload, @Param('id') id: string) { return this.service.claimRequisition(me, id); }

  @Post('requisitions/:id/reject')
  @RequirePermissions('compras:buy', 'compras:manage')
  rejectRequisition(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body(new ZodValidationPipe(requisitionRejectSchema)) body: any) { return this.service.rejectRequisition(me, id, body); }

  @Post('requisitions/:id/cancel')
  @RequirePermissions('compras:request', 'compras:view')
  cancelRequisition(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body(new ZodValidationPipe(cancellationSchema)) body: any) { return this.service.cancelRequisition(me, id, body); }

  @Get('orders')
  @RequirePermissions('compras:view', 'compras:buy', 'compras:approve', 'compras:manage')
  orders(@CurrentUser() me: AuthPayload, @Query('status') status?: string) { return this.service.listOrders(me, status); }

  @Post('orders')
  @RequirePermissions('compras:buy', 'compras:manage')
  createOrder(@CurrentUser() me: AuthPayload, @Body(new ZodValidationPipe(purchaseOrderCreateSchema)) body: any) { return this.service.createOrder(me, body); }

  @Post('orders/:id/submit')
  @RequirePermissions('compras:buy', 'compras:manage')
  submitOrder(@CurrentUser() me: AuthPayload, @Param('id') id: string) { return this.service.submitOrder(me, id); }

  @Post('orders/:id/approve')
  @RequirePermissions('compras:approve', 'compras:manage')
  approveOrder(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body(new ZodValidationPipe(approvalDecisionSchema)) body: any) { return this.service.decideOrder(me, id, 'APPROVED', body); }

  @Post('orders/:id/reject')
  @RequirePermissions('compras:approve', 'compras:manage')
  rejectOrder(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body(new ZodValidationPipe(rejectionDecisionSchema)) body: any) { return this.service.decideOrder(me, id, 'REJECTED', body); }

  @Post('orders/:id/send')
  @RequirePermissions('compras:buy', 'compras:manage')
  sendOrder(@CurrentUser() me: AuthPayload, @Param('id') id: string) { return this.service.sendOrder(me, id); }

  @Post('orders/:id/cancel')
  @RequirePermissions('compras:buy', 'compras:manage')
  cancelOrder(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body(new ZodValidationPipe(cancellationSchema)) body: any) { return this.service.cancelOrder(me, id, body); }

  @Post('orders/:id/close')
  @RequirePermissions('compras:buy', 'compras:manage')
  closeOrder(@CurrentUser() me: AuthPayload, @Param('id') id: string) { return this.service.closeOrder(me, id); }

  @Post('orders/:id/receive')
  @RequirePermissions('estoque:operate', 'estoque:manage')
  receiveOrder(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body(new ZodValidationPipe(purchaseReceiptSchema)) body: any) { return this.service.receiveOrder(me, id, body); }

  @Get('receipts')
  @RequirePermissions('compras:view', 'estoque:view')
  receipts(@CurrentUser() me: AuthPayload) { return this.service.listReceipts(me); }

  @Get('quotations')
  @RequirePermissions('compras:view', 'compras:buy')
  quotations(@CurrentUser() me: AuthPayload) { return this.service.listQuotations(me); }

  @Post('quotations')
  @RequirePermissions('compras:buy', 'compras:manage')
  createQuotation(@CurrentUser() me: AuthPayload, @Body(new ZodValidationPipe(quotationCreateSchema)) body: any) { return this.service.createQuotation(me, body); }

  @Post('quotations/:id/quotes')
  @RequirePermissions('compras:buy', 'compras:manage')
  addSupplierQuote(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body(new ZodValidationPipe(supplierQuoteCreateSchema)) body: any) { return this.service.addSupplierQuote(me, id, body); }

  @Get('quotations/:id/map')
  @RequirePermissions('compras:view', 'compras:buy')
  quotationMap(@CurrentUser() me: AuthPayload, @Param('id') id: string) { return this.service.quotationMap(me, id); }

  @Post('quotations/:id/award')
  @RequirePermissions('compras:buy', 'compras:manage')
  awardQuotation(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body(new ZodValidationPipe(quotationAwardSchema)) body: any) { return this.service.awardQuotation(me, id, body); }

  @Get('invoices')
  @RequirePermissions('compras:view', 'compras:buy', 'estoque:view')
  invoices(@CurrentUser() me: AuthPayload) { return this.service.listInvoices(me); }

  @Post('invoices/material')
  @RequirePermissions('compras:buy', 'compras:manage', 'estoque:operate')
  createMaterialInvoice(@CurrentUser() me: AuthPayload, @Body(new ZodValidationPipe(materialInvoiceCreateSchema)) body: any) { return this.service.createMaterialInvoice(me, body); }

  @Post('invoices/:id/verify')
  @RequirePermissions('compras:buy', 'compras:manage')
  verifyInvoice(@CurrentUser() me: AuthPayload, @Param('id') id: string) { return this.service.verifyInvoice(me, id); }

  @Post('invoices/:id/return')
  @RequirePermissions('compras:buy', 'compras:manage')
  returnInvoice(@CurrentUser() me: AuthPayload, @Param('id') id: string, @Body(new ZodValidationPipe(invoiceReturnSchema)) body: any) { return this.service.returnInvoice(me, id, body); }
}
