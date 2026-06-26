'use client';

import { useCommunication } from '@/components/communication/communication-provider';
import { FloatingChatBox } from './floating-chat-box';

export function FloatingChatManager() {
  const { openConversations, closeChat, toggleMinimizeChat } = useCommunication();

  if (openConversations.length === 0) return null;

  return (
    <div className="fixed bottom-0 right-4 z-50 flex items-end gap-3 pointer-events-none max-w-[calc(100vw-2rem)] overflow-x-auto scrollbar-none pb-0">
      {openConversations.map((chat) => (
        <div key={chat.id} className="pointer-events-auto shrink-0">
          <FloatingChatBox
            conversationId={chat.id}
            title={chat.title}
            avatarUrl={chat.avatarUrl}
            minimized={chat.minimized}
            presence={chat.presence}
            hasUnread={!!chat.hasUnread}
            onClose={() => closeChat(chat.id)}
            onMinimize={() => toggleMinimizeChat(chat.id)}
          />
        </div>
      ))}
    </div>
  );
}
