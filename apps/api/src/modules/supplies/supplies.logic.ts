import { BadRequestException, ConflictException } from '@nestjs/common';
import { randomUUID } from 'crypto';

export const REQUISITION_TRANSITIONS: Record<string, readonly string[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['IN_TRIAGE', 'REJECTED', 'CANCELLED'],
  IN_TRIAGE: ['IN_QUOTATION', 'ORDER_CREATED', 'REJECTED', 'CANCELLED'],
  IN_QUOTATION: ['ORDER_CREATED', 'REJECTED', 'CANCELLED'],
  ORDER_CREATED: ['PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED'],
  PARTIALLY_FULFILLED: ['FULFILLED'],
  FULFILLED: [],
  REJECTED: [],
  CANCELLED: [],
};

export const PURCHASE_ORDER_TRANSITIONS: Record<string, readonly string[]> = {
  DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['SENT', 'CANCELLED'],
  REJECTED: ['DRAFT', 'CANCELLED'],
  SENT: ['PARTIALLY_DELIVERED', 'DELIVERED', 'CANCELLED'],
  PARTIALLY_DELIVERED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['CLOSED'],
  CLOSED: [],
  CANCELLED: [],
};

export const WITHDRAWAL_TRANSITIONS: Record<string, readonly string[]> = {
  REQUESTED: ['APPROVED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['PARTIALLY_FULFILLED', 'FULFILLED', 'REJECTED', 'CANCELLED'],
  PARTIALLY_FULFILLED: ['FULFILLED', 'CANCELLED'],
  FULFILLED: [],
  REJECTED: [],
  CANCELLED: [],
};

export const QUOTATION_TRANSITIONS: Record<string, readonly string[]> = {
  OPEN: ['AWARDED', 'CANCELLED'],
  AWARDED: [],
  CANCELLED: [],
};

export const INVOICE_TRANSITIONS: Record<string, readonly string[]> = {
  POSTED: ['VERIFIED', 'RETURNED'],
  VERIFIED: [],
  RETURNED: [],
};

export function assertTransition(machine: Record<string, readonly string[]>, current: string, next: string, label: string): void {
  if (!(machine[current] ?? []).includes(next)) {
    throw new ConflictException(`${label}: transição inválida de ${current} para ${next}.`);
  }
}

export function positiveNumber(value: unknown, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new BadRequestException(`${label} deve ser maior que zero.`);
  return parsed;
}

export function nonNegativeNumber(value: unknown, label: string): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) throw new BadRequestException(`${label} não pode ser negativo.`);
  return parsed;
}

export function weightedAverage(currentQuantity: number, currentAverage: number, incomingQuantity: number, incomingCost: number): number {
  if (incomingQuantity <= 0) throw new Error('incomingQuantity must be positive');
  const nextQuantity = currentQuantity + incomingQuantity;
  if (nextQuantity <= 0) return 0;
  return ((currentQuantity * currentAverage) + (incomingQuantity * incomingCost)) / nextQuantity;
}

export function orderTotals(
  lines: Array<{ quantity: unknown; unitPrice: unknown }>,
  freight: unknown = 0,
  discount: unknown = 0,
): { subtotal: number; freight: number; discount: number; total: number } {
  const subtotal = lines.reduce((sum, line) => sum + positiveNumber(line.quantity, 'Quantidade') * nonNegativeNumber(line.unitPrice, 'Preço unitário'), 0);
  const freightValue = nonNegativeNumber(freight, 'Frete');
  const discountValue = nonNegativeNumber(discount, 'Desconto');
  const total = subtotal + freightValue - discountValue;
  if (total < 0) throw new BadRequestException('O desconto não pode superar o subtotal somado ao frete.');
  return { subtotal, freight: freightValue, discount: discountValue, total };
}

export function requisitionStatusFromQuantities(lines: Array<{ requested: unknown; received: unknown }>): 'ORDER_CREATED' | 'PARTIALLY_FULFILLED' | 'FULFILLED' {
  const requested = lines.reduce((sum, line) => sum + Number(line.requested), 0);
  const received = lines.reduce((sum, line) => sum + Number(line.received), 0);
  if (received <= 0) return 'ORDER_CREATED';
  if (received + 1e-9 < requested) return 'PARTIALLY_FULFILLED';
  return 'FULFILLED';
}

export function orderStatusFromQuantities(lines: Array<{ ordered: unknown; received: unknown }>): 'SENT' | 'PARTIALLY_DELIVERED' | 'DELIVERED' {
  const materialLines = lines.filter((line) => Number(line.ordered) > 0);
  const ordered = materialLines.reduce((sum, line) => sum + Number(line.ordered), 0);
  const received = materialLines.reduce((sum, line) => sum + Number(line.received), 0);
  if (received <= 0) return 'SENT';
  if (received + 1e-9 < ordered) return 'PARTIALLY_DELIVERED';
  return 'DELIVERED';
}

export interface QuotationMapQuote {
  id: string;
  supplierId: string;
  status: string;
  totalAmount: unknown;
  items: Array<{ requisitionItemId: string; quantity: unknown; unitPrice: unknown; totalPrice: unknown }>;
}

export interface QuotationMapRow {
  requisitionItemId: string;
  cells: Array<{ supplierQuoteId: string; quantity: number; unitPrice: number; totalPrice: number; best: boolean } | null>;
}

/// Mapa comparativo puro: uma linha por item da requisição, uma coluna por
/// proposta RECEIVED, com o menor preço unitário de cada linha marcado.
export function buildQuotationMap(
  requisitionItemIds: string[],
  quotes: QuotationMapQuote[],
): { rows: QuotationMapRow[]; cheapestQuoteId: string | null } {
  const received = quotes.filter((quote) => quote.status === 'RECEIVED');
  const rows: QuotationMapRow[] = requisitionItemIds.map((requisitionItemId) => {
    const cells = received.map((quote) => {
      const line = quote.items.find((candidate) => candidate.requisitionItemId === requisitionItemId);
      if (!line) return null;
      return { supplierQuoteId: quote.id, quantity: Number(line.quantity), unitPrice: Number(line.unitPrice), totalPrice: Number(line.totalPrice), best: false };
    });
    const prices = cells.filter((cell): cell is NonNullable<typeof cell> => cell !== null).map((cell) => cell.unitPrice);
    if (prices.length) {
      const lowest = Math.min(...prices);
      for (const cell of cells) if (cell && cell.unitPrice <= lowest + 1e-9) cell.best = true;
    }
    return { requisitionItemId, cells };
  });
  const cheapest = received.length ? received.reduce((best, quote) => (Number(quote.totalAmount) < Number(best.totalAmount) ? quote : best)) : null;
  return { rows, cheapestQuoteId: cheapest?.id ?? null };
}

export function businessNumber(prefix: string, now = new Date(), random = cryptoRandom()): string {
  const month = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  return `${prefix}-${month}-${random.toUpperCase()}`;
}

function cryptoRandom(): string {
  return randomUUID().replaceAll('-', '').slice(0, 8);
}
