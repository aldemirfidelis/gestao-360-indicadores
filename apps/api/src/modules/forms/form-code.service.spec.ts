import { describe, expect, it, vi } from 'vitest';
import { FormCodeService } from './form-code.service';

/**
 * Regressão do 500 em POST /forms.
 *
 * `ensureDefaults` roda em toda criação de formulário, e usava `upsert` pela
 * única composta `companyId_name_parentId` passando `parentId: null` — que o
 * Prisma recusa. Como o mock de Prisma nos testes aceita qualquer coisa, o
 * defeito passou batido; por isso aqui checamos o INVARIANTE (nunca mandar
 * `null` dentro de uma chave única composta), não só o resultado.
 */
function txMock(existingFolders: any[] = []) {
  return {
    formTypeConfig: { upsert: vi.fn().mockImplementation((a: any) => Promise.resolve({ id: 'type', ...a.create })) },
    formCategory: { upsert: vi.fn().mockImplementation((a: any) => Promise.resolve({ id: 'cat', ...a.create })) },
    formTag: { upsert: vi.fn().mockImplementation((a: any) => Promise.resolve({ id: 'tag', ...a.create })) },
    formFolder: {
      findFirst: vi.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(existingFolders.find((f) => f.name === where.name && f.parentId === null) ?? null),
      ),
      create: vi.fn().mockImplementation((a: any) => Promise.resolve({ id: `folder-${a.data.name}`, active: true, ...a.data })),
      update: vi.fn().mockImplementation((a: any) => Promise.resolve({ id: a.where.id, active: true })),
      upsert: vi.fn(),
    },
  };
}

/** Procura `null`/`undefined` dentro dos objetos de chave composta do `where`. */
function nullInsideCompositeKey(where: any): boolean {
  return Object.values(where ?? {}).some(
    (value) => value !== null && typeof value === 'object' && Object.values(value as object).some((inner) => inner === null || inner === undefined),
  );
}

describe('FormCodeService.ensureDefaults', () => {
  it('cria tipos, categorias, pastas e tags padrão', async () => {
    const tx = txMock();
    const result = await new FormCodeService().ensureDefaults(tx, 'empresa-1', 'user-1');

    expect(result.types).toHaveLength(3);
    expect(result.categories).toHaveLength(6);
    expect(result.folders).toHaveLength(4);
    expect(result.tags).toHaveLength(4);
  });

  it('não usa upsert com parentId null na pasta raiz (era o 500 do POST /forms)', async () => {
    const tx = txMock();
    await new FormCodeService().ensureDefaults(tx, 'empresa-1', 'user-1');

    expect(tx.formFolder.upsert).not.toHaveBeenCalled();
    expect(tx.formFolder.findFirst).toHaveBeenCalledTimes(4);
    expect(tx.formFolder.create).toHaveBeenCalledTimes(4);
  });

  it('nenhuma chave única composta recebe null — Prisma recusa', async () => {
    const tx = txMock();
    await new FormCodeService().ensureDefaults(tx, 'empresa-1', 'user-1');

    for (const model of [tx.formTypeConfig, tx.formCategory, tx.formTag]) {
      for (const call of model.upsert.mock.calls) {
        expect(nullInsideCompositeKey(call[0].where)).toBe(false);
      }
    }
    for (const call of tx.formFolder.findFirst.mock.calls) {
      expect(nullInsideCompositeKey(call[0].where)).toBe(false);
    }
  });

  it('rodar de novo não duplica a pasta que já existe', async () => {
    const tx = txMock([{ id: 'f1', name: 'Operacional', parentId: null, active: true }]);
    await new FormCodeService().ensureDefaults(tx, 'empresa-1', 'user-1');

    expect(tx.formFolder.create).toHaveBeenCalledTimes(3);
    const criadas = tx.formFolder.create.mock.calls.map((c: any[]) => c[0].data.name);
    expect(criadas).not.toContain('Operacional');
  });

  it('pasta padrão desativada volta a ficar ativa', async () => {
    const tx = txMock([{ id: 'f1', name: 'Operacional', parentId: null, active: false }]);
    await new FormCodeService().ensureDefaults(tx, 'empresa-1', 'user-1');

    expect(tx.formFolder.update).toHaveBeenCalledWith({ where: { id: 'f1' }, data: { active: true } });
  });

  it('pasta ativa não sofre update à toa', async () => {
    const tx = txMock([{ id: 'f1', name: 'Operacional', parentId: null, active: true }]);
    await new FormCodeService().ensureDefaults(tx, 'empresa-1', 'user-1');

    expect(tx.formFolder.update).not.toHaveBeenCalled();
  });
});
