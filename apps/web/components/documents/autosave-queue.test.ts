import { describe, expect, it, vi } from 'vitest';
import { AutosaveQueue } from './autosave-queue';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

describe('salvamento do editor antes de sair da aba', () => {
  it('aguarda a gravação em andamento e salva a edição mais recente em seguida', async () => {
    const first = deferred();
    const save = vi.fn().mockImplementationOnce(() => first.promise).mockResolvedValue(undefined);
    const queue = new AutosaveQueue<string>(save);
    queue.enqueue('primeira');
    const autosave = queue.flush();
    await Promise.resolve();
    queue.enqueue('segunda');
    queue.enqueue('última');
    let left = false;
    const leave = queue.flush().then(() => { left = true; });
    await Promise.resolve();
    expect(left).toBe(false);
    expect(save).toHaveBeenCalledTimes(1);
    first.resolve();
    await Promise.all([autosave, leave]);
    expect(save.mock.calls.map(([value]) => value)).toEqual(['primeira', 'última']);
    expect(queue.hasChanges).toBe(false);
    expect(left).toBe(true);
  });

  it('uma falha impede a saída e mantém a edição mais recente para tentar novamente', async () => {
    const first = deferred();
    const save = vi.fn().mockImplementationOnce(() => first.promise).mockResolvedValue(undefined);
    const queue = new AutosaveQueue<string>(save);
    queue.enqueue('primeira');
    const autosave = queue.flush();
    const leave = queue.flush();
    queue.enqueue('correção');
    first.reject(new Error('sem conexão'));
    const results = await Promise.allSettled([autosave, leave]);
    expect(results.every((result) => result.status === 'rejected')).toBe(true);
    expect(queue.hasChanges).toBe(true);
    await queue.flush();
    expect(save.mock.calls.map(([value]) => value)).toEqual(['primeira', 'correção']);
    expect(queue.hasChanges).toBe(false);
  });
});
