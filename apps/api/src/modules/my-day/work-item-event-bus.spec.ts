import { describe, it, expect, vi } from 'vitest';
import { WorkItemEventBus } from './work-item-event-bus';

describe('WorkItemEventBus', () => {
  it('emite dirty com userIds deduplicados e sem nulos', () => {
    const bus = new WorkItemEventBus();
    const handler = vi.fn();
    bus.onDirty(handler);

    bus.markDirty('c1', ['u1', null, 'u1', undefined, 'u2'], 'reason');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toEqual({ companyId: 'c1', userIds: ['u1', 'u2'], reason: 'reason' });
  });

  it('nao emite quando nao ha empresa ou usuarios', () => {
    const bus = new WorkItemEventBus();
    const handler = vi.fn();
    bus.onDirty(handler);

    bus.markDirty('c1', [null, undefined]);
    bus.markDirty('', ['u1']);

    expect(handler).not.toHaveBeenCalled();
  });
});
