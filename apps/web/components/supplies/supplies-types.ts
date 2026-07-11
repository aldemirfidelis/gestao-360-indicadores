export type DecimalValue = string | number;

export interface Warehouse {
  id: string; code: string; name: string; description?: string | null; orgNodeId?: string | null;
  managerUserId?: string | null; address?: string | null; allowNegative: boolean; active: boolean;
}

export interface StockItem {
  id: string; code: string; name: string; description?: string | null; kind: 'MATERIAL' | 'SERVICE'; unit: string;
  groupName?: string | null; minimumStock?: DecimalValue | null; maximumStock?: DecimalValue | null; averageCost: DecimalValue; active: boolean;
}

export interface StockBalance {
  id: string; quantity: DecimalValue; averageCost: DecimalValue; totalValue: DecimalValue; lastMovementAt?: string | null;
  warehouse: Pick<Warehouse, 'id' | 'code' | 'name'>; item: StockItem;
}

export interface StockMovement {
  id: string; type: string; quantity: DecimalValue; unitCost: DecimalValue; totalCost: DecimalValue; balanceBefore: DecimalValue;
  balanceAfter: DecimalValue; averageCostAfter: DecimalValue; originType: string; reference?: string | null; reason?: string | null;
  actorId: string; occurredAt: string; warehouse: Pick<Warehouse, 'id' | 'code' | 'name'>;
  counterpartyWarehouse?: Pick<Warehouse, 'id' | 'code' | 'name'> | null; item: Pick<StockItem, 'id' | 'code' | 'name' | 'unit'>;
}

export interface Supplier {
  id: string; code: string; legalName: string; tradeName?: string | null; documentNumber?: string | null; contactName?: string | null;
  email?: string | null; phone?: string | null; paymentTerms?: string | null; rating?: DecimalValue | null; active: boolean;
}

export interface ApprovalRule {
  id: string; name: string; level: number; minimumAmount: DecimalValue; maximumAmount?: DecimalValue | null;
  approverUserId?: string | null; approverRole?: string | null; active: boolean;
  users?: Record<string, { id: string; name: string; email: string } | null>;
}

export interface RequisitionItem {
  id: string; itemId: string; requestedQuantity: DecimalValue; estimatedUnitCost?: DecimalValue | null; orderedQuantity: DecimalValue;
  receivedQuantity: DecimalValue; note?: string | null; item: StockItem;
}

export interface PurchaseRequisition {
  id: string; number: string; title: string; status: string; urgency: string; warehouseId: string; requesterId: string; buyerId?: string | null;
  orgNodeId?: string | null; justification: string; neededAt?: string | null; createdAt: string; warehouse: Pick<Warehouse, 'id' | 'code' | 'name'>;
  items: RequisitionItem[]; purchaseOrders: Array<{ id: string; number: string; status: string; totalAmount: DecimalValue }>;
  users?: Record<string, { id: string; name: string; email: string } | null>;
}

export interface PurchaseOrderItem {
  id: string; requisitionItemId?: string | null; itemId: string; kindSnapshot: string; description: string; unit: string;
  orderedQuantity: DecimalValue; unitPrice: DecimalValue; totalPrice: DecimalValue; receivedQuantity: DecimalValue; item: StockItem;
}

export interface PurchaseOrderApproval {
  id: string; level: number; ruleName?: string | null; orderAmount: DecimalValue; approverUserId?: string | null; approverRole?: string | null;
  status: string; decidedById?: string | null; decisionNote?: string | null; decidedAt?: string | null;
}

export interface PurchaseOrder {
  id: string; number: string; status: string; totalAmount: DecimalValue; subtotal: DecimalValue; freightAmount: DecimalValue; discountAmount: DecimalValue;
  paymentTerms?: string | null; expectedDeliveryAt?: string | null; createdById: string; createdAt: string;
  supplier: Supplier; warehouse: Warehouse; requisition?: { id: string; number: string; title: string; requesterId: string; buyerId?: string | null } | null;
  items: PurchaseOrderItem[]; approvals: PurchaseOrderApproval[]; receipts: Array<{ id: string; number: string; receivedAt: string }>;
}

export interface WithdrawalItem {
  id: string; itemId: string; requestedQuantity: DecimalValue; approvedQuantity?: DecimalValue | null; fulfilledQuantity: DecimalValue; item: StockItem;
}

export interface MaterialWithdrawal {
  id: string; number: string; warehouseId: string; requesterId: string; orgNodeId?: string | null; status: string; justification: string;
  neededAt?: string | null; createdAt: string; warehouse: Warehouse; items: WithdrawalItem[];
}

export interface ProcurementOptions {
  warehouses: Array<Pick<Warehouse, 'id' | 'code' | 'name' | 'managerUserId'>>;
  items: Array<Pick<StockItem, 'id' | 'code' | 'name' | 'kind' | 'unit' | 'averageCost'>>;
  suppliers: Array<Pick<Supplier, 'id' | 'code' | 'legalName' | 'tradeName' | 'paymentTerms'>>;
  users: Array<{ id: string; name: string; email: string; role: string }>;
  orgNodes: Array<{ id: string; name: string; code?: string | null; type: string }>;
}

export interface ProcurementDashboard {
  openRequisitions: number; buyerQueue: number; pendingApprovals: number; openOrders: number; overdueOrders: number;
  receiptsThisMonth: number; spendThisMonth: DecimalValue;
}

export interface InventoryDashboard {
  warehouses: number; items: number; belowMinimum: number; pendingWithdrawals: number; inventoryValue: DecimalValue; recentMovements: StockMovement[];
}
