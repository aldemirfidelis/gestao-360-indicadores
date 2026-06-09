import { Global, Injectable, Module } from '@nestjs/common';
import { EventEmitter } from 'events';

export interface WorkItemDirtyEvent {
  companyId: string;
  userIds: string[];
  reason?: string;
}

/**
 * Bus de eventos in-process (sem dependencia externa) para invalidar/atualizar a
 * projecao "Meu Dia" quando um registro de origem muda. Servicos de qualquer
 * modulo chamam `markDirty(...)` apos uma escrita; o MyDay assina via `onDirty`.
 * @Global para ser injetavel em qualquer modulo sem criar ciclos.
 */
@Injectable()
export class WorkItemEventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  markDirty(companyId: string, userIds: Array<string | null | undefined>, reason?: string): void {
    const ids = [...new Set(userIds.filter((u): u is string => !!u))];
    if (!companyId || ids.length === 0) return;
    this.emitter.emit('dirty', { companyId, userIds: ids, reason } satisfies WorkItemDirtyEvent);
  }

  onDirty(handler: (event: WorkItemDirtyEvent) => void): void {
    this.emitter.on('dirty', handler);
  }
}

@Global()
@Module({
  providers: [WorkItemEventBus],
  exports: [WorkItemEventBus],
})
export class WorkItemEventsModule {}
