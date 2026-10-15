import { useParams } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { useConversations, usePublicUser } from '../api/hooks';
import { ChatRoom, ConversationList, useChatSocket } from '../components/chat/ChatParts';
import { cn } from '../lib/cn';

export function ChatPage() {
  const { userId } = useParams();
  useChatSocket();
  const { data: conversations = [], isLoading } = useConversations();
  const { data: fetchedUser } = usePublicUser(userId);
  const other = conversations.find((c) => c.otherUser.id === userId)?.otherUser ?? fetchedUser;

  return (
    <div className="page-container h-[calc(100dvh-64px)] py-4">
      <div className="grid h-full grid-cols-1 gap-4 md:grid-cols-[320px_1fr]">
        <div className={cn('min-h-0', userId ? 'hidden md:block' : 'block')}>
          <ConversationList conversations={conversations} loading={isLoading} activeId={userId} pendingUser={userId ? fetchedUser : undefined} />
        </div>
        <div className={cn('min-h-0', userId ? 'block' : 'hidden md:block')}>
          {userId ? (
            <ChatRoom key={userId} otherId={userId} other={other} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 rounded-card bg-surface p-6 text-center shadow-card">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-accent">
                <MessageCircle size={26} />
              </span>
              <h2 className="text-lg font-semibold">Pilih percakapan</h2>
              <p className="max-w-xs text-sm text-muted">Pilih percakapan di sebelah kiri untuk mulai berbalas pesan.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
