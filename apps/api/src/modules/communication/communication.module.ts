import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { requireSecret } from '../../common/env';
import { NotificationsModule } from '../notifications/notifications.module';
import { DirectoryController } from './directory/directory.controller';
import { DirectoryService } from './directory/directory.service';
import { ProfileController } from './profile/profile.controller';
import { ProfileService } from './profile/profile.service';
import { PresenceService } from './presence/presence.service';
import { InMemoryPresenceStore, PRESENCE_STORE } from './presence/presence.store';
import { RealtimeEmitter } from './realtime.emitter';
import { ConversationService } from './conversations/conversation.service';
import { MessageService } from './conversations/message.service';
import { ConversationsController } from './conversations/conversations.controller';
import { CommunicationGateway } from './communication.gateway';

/**
 * Módulo de Comunicação Corporativa.
 * Fase 1: Diretório Global, Perfil corporativo e Presença em tempo real.
 * (Fase 2 adiciona Conversas/Mensagens reaproveitando este gateway e a presença.)
 */
@Module({
  imports: [
    NotificationsModule,
    JwtModule.registerAsync({
      useFactory: () => ({ secret: requireSecret('JWT_ACCESS_SECRET') }),
    }),
  ],
  controllers: [DirectoryController, ProfileController, ConversationsController],
  providers: [
    { provide: PRESENCE_STORE, useClass: InMemoryPresenceStore },
    RealtimeEmitter,
    PresenceService,
    DirectoryService,
    ProfileService,
    ConversationService,
    MessageService,
    CommunicationGateway,
  ],
  exports: [PresenceService],
})
export class CommunicationModule {}
