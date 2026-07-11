import { ConflictException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  PURCHASE_ORDER_TRANSITIONS,
  assertTransition,
  orderStatusFromQuantities,
  orderTotals,
  requisitionStatusFromQuantities,
  weightedAverage,
} from './supplies.logic';

describe('Supplies domain logic', () => {
  it('calculates moving weighted average without floating stock drift', () => {
    expect(weightedAverage(10, 20, 5, 32)).toBeCloseTo(24, 8);
    expect(weightedAverage(0, 0, 3, 12.5)).toBeCloseTo(12.5, 8);
  });

  it('calculates order total with freight and discount', () => {
    expect(orderTotals([{ quantity: 2, unitPrice: 10 }, { quantity: 3, unitPrice: 5 }], 4, 2)).toEqual({
      subtotal: 35, freight: 4, discount: 2, total: 37,
    });
  });

  it('blocks delivery before approval/sending', () => {
    expect(() => assertTransition(PURCHASE_ORDER_TRANSITIONS, 'DRAFT', 'DELIVERED', 'Pedido')).toThrow(ConflictException);
    expect(() => assertTransition(PURCHASE_ORDER_TRANSITIONS, 'APPROVED', 'SENT', 'Pedido')).not.toThrow();
  });

  it('derives partial and completed states from cumulative receipts', () => {
    expect(orderStatusFromQuantities([{ ordered: 10, received: 0 }])).toBe('SENT');
    expect(orderStatusFromQuantities([{ ordered: 10, received: 4 }])).toBe('PARTIALLY_DELIVERED');
    expect(orderStatusFromQuantities([{ ordered: 10, received: 10 }])).toBe('DELIVERED');
    expect(requisitionStatusFromQuantities([{ requested: 10, received: 4 }])).toBe('PARTIALLY_FULFILLED');
    expect(requisitionStatusFromQuantities([{ requested: 10, received: 10 }])).toBe('FULFILLED');
  });
});
