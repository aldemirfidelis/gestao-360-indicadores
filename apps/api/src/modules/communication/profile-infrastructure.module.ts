import { Module } from '@nestjs/common';
import { ProfileInfrastructureController } from './profile-infrastructure.controller';
import { ProfileService } from './profile/profile.service';
import { PresenceService } from './presence/presence.service';
import { InMemoryPresenceStore, PRESENCE_STORE } from './presence/presence.store';
import { RealtimeEmitter } from './realtime.emitter';

/** Perfil próprio sem montar publicações, chat ou gateway WebSocket. */
@Module({
  controllers: [ProfileInfrastructureController],
  providers: [ProfileService, PresenceService, RealtimeEmitter, { provide: PRESENCE_STORE, useClass: InMemoryPresenceStore }],
  exports: [RealtimeEmitter],
})
export class ProfileInfrastructureModule {}
