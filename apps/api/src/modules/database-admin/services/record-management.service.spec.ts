import { describe, expect, it, vi } from 'vitest';
import { RecordManagementService } from './record-management.service';

const columns = [
  {
    name: 'id', dataType: 'text', udtName: 'text', nullable: false, default: null,
    maxLength: null, position: 1, isPrimaryKey: true, isForeignKey: false,
  },
  {
    name: 'companyId', dataType: 'text', udtName: 'text', nullable: false, default: null,
    maxLength: null, position: 2, isPrimaryKey: false, isForeignKey: false,
  },
  {
    name: 'name', dataType: 'text', udtName: 'text', nullable: false, default: null,
    maxLength: null, position: 3, isPrimaryKey: false, isForeignKey: false,
  },
];

function setup() {
  const tx = { query: vi.fn(), execute: vi.fn() };
  const pg = {
    runReadOnly: vi.fn(),
    runInTransaction: vi.fn(async (callback: (client: typeof tx) => unknown) => ({
      result: await callback(tx),
      transactionId: 'tx-1',
    })),
  };
  const schema = {
    assertCompanyScopedTable: vi.fn().mockResolvedValue(undefined),
    getColumns: vi.fn().mockResolvedValue(columns),
  };
  const backup = { snapshot: vi.fn() };
  const audit = { record: vi.fn().mockResolvedValue(null) };
  const service = new RecordManagementService(pg as any, schema as any, backup as any, audit as any);
  return { service, pg, schema, tx, backup, audit };
}

describe('RecordManagementService - escopo empresarial obrigatorio', () => {
  it('adiciona companyId a contagem e leitura de registros', async () => {
    const { service, pg } = setup();
    pg.runReadOnly
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 'row-1', companyId: 'company-1', name: 'Registro' }] });

    const result = await service.getRows('ScopedTable', { page: 1, pageSize: 25 }, 'company-1');

    expect(result.total).toBe(1);
    expect(pg.runReadOnly).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('WHERE "companyId" = $1'),
      { params: ['company-1'] },
    );
    expect(pg.runReadOnly).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('WHERE "companyId" = $1'),
      { params: ['company-1', 25, 0] },
    );
  });

  it('sobrescreve companyId informado pelo cliente ao inserir', async () => {
    const { service, tx } = setup();
    tx.query.mockResolvedValue([{ id: 'row-1', companyId: 'company-1', name: 'Registro' }]);
    const user = { sub: 'admin-1', email: 'admin@test', name: 'Admin', role: 'SUPER_ADMIN', companyId: 'company-1' } as any;

    await service.insert(
      'ScopedTable',
      { id: 'row-1', companyId: 'company-2', name: 'Registro' },
      user,
      {},
    );

    expect(tx.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "ScopedTable"'),
      expect.arrayContaining(['row-1', 'company-1', 'Registro']),
    );
    expect(tx.query.mock.calls[0][1]).not.toContain('company-2');
  });
});
