import { expect, test } from '@playwright/test';
import { adminCredentials, apiGet, apiPost, loginApi, type Session, uniqueCode } from './helpers';

test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);

let session: Session;

test.beforeAll(async ({ request }) => {
  session = await loginApi(request, {
    email: process.env.E2E_SUPPLIES_ADMIN_EMAIL ?? adminCredentials.email,
    password: process.env.E2E_SUPPLIES_ADMIN_PASSWORD ?? adminCredentials.password,
  });
});

test('API: requisição -> pedido -> alçada -> recebimento -> kardex é idempotente', async ({ request }) => {
  const token = session.accessToken;
  const suffix = uniqueCode('SUP');
  const warehouse = await apiPost<any>(request, token, '/inventory/warehouses', {
    code: `ALM-${suffix}`, name: `Almoxarifado E2E ${suffix}`, allowNegative: false,
  });
  const item = await apiPost<any>(request, token, '/inventory/items', {
    code: `MAT-${suffix}`, name: `Material E2E ${suffix}`, kind: 'MATERIAL', unit: 'UN', minimumStock: 2, maximumStock: 100,
  });
  const supplier = await apiPost<any>(request, token, '/procurement/suppliers', {
    code: `FOR-${suffix}`, legalName: `Fornecedor E2E ${suffix}`, paymentTerms: '28 dias',
  });
  const requisition = await apiPost<any>(request, token, '/procurement/requisitions', {
    title: `Reposição E2E ${suffix}`, warehouseId: warehouse.id, urgency: 'HIGH', justification: 'Validação integrada de Suprimentos', submit: true,
    items: [{ itemId: item.id, quantity: 10, estimatedUnitCost: 12.5 }],
  });
  expect(requisition.status).toBe('SUBMITTED');

  const claimed = await apiPost<any>(request, token, `/procurement/requisitions/${requisition.id}/claim`, {});
  expect(claimed.status).toBe('IN_TRIAGE');
  expect(claimed.buyerId).toBe(session.user.id);

  const order = await apiPost<any>(request, token, '/procurement/orders', {
    requisitionId: requisition.id, supplierId: supplier.id, freightAmount: 5, discountAmount: 0,
    items: [{ requisitionItemId: requisition.items[0].id, quantity: 10, unitPrice: 12.5 }],
  });
  expect(Number(order.totalAmount)).toBe(130);
  const pending = await apiPost<any>(request, token, `/procurement/orders/${order.id}/submit`, {});
  expect(pending.status).toBe('PENDING_APPROVAL');
  const approved = await apiPost<any>(request, token, `/procurement/orders/${order.id}/approve`, {});
  expect(approved.status).toBe('APPROVED');
  const sent = await apiPost<any>(request, token, `/procurement/orders/${order.id}/send`, {});
  expect(sent.status).toBe('SENT');

  const idempotencyKey = `e2e-receipt-${suffix}`;
  const receipt = await apiPost<any>(request, token, `/procurement/orders/${order.id}/receive`, {
    idempotencyKey, deliveryNote: `ROM-${suffix}`, items: [{ purchaseOrderItemId: order.items[0].id, quantity: 10 }],
  });
  const repeated = await apiPost<any>(request, token, `/procurement/orders/${order.id}/receive`, {
    idempotencyKey, deliveryNote: `ROM-${suffix}`, items: [{ purchaseOrderItemId: order.items[0].id, quantity: 10 }],
  });
  expect(repeated.id).toBe(receipt.id);

  const balances = await apiGet<any[]>(request, token, `/inventory/balances?warehouseId=${warehouse.id}&itemId=${item.id}`);
  expect(balances).toHaveLength(1);
  expect(Number(balances[0].quantity)).toBe(10);
  expect(Number(balances[0].averageCost)).toBe(12.5);
  const movements = await apiGet<any[]>(request, token, `/inventory/movements?warehouseId=${warehouse.id}&itemId=${item.id}`);
  expect(movements.filter((movement) => movement.originType === 'PURCHASE_RECEIPT')).toHaveLength(1);
  expect(Number(movements[0].balanceAfter)).toBe(10);
});

test('UI: abre o painel funcional de Suprimentos', async ({ page }) => {
  await page.addInitScript(({ accessToken, refreshToken }) => {
    window.localStorage.setItem('g360.accessToken', accessToken);
    window.localStorage.setItem('g360.refreshToken', refreshToken);
  }, session);
  await page.goto('/suprimentos');
  await expect(page.getByRole('heading', { name: 'Suprimentos' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('tab', { name: 'Requisições' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nova requisição' })).toBeVisible();
});
