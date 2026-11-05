import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Send } from 'lucide-react';
import type { ChatHistory, ConversationSummary, PublicUser } from '@kosmatch/shared';
import { qk, useMessages } from '../../api/hooks';
import { errorMessage } from '../../api/client';
import { connectSocket, sendChatMessage, useConnectionStore } from '../../lib/socket';
import { formatTime } from '../../lib/format';
import { cn } from '../../lib/cn';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/toastStore';
import { Avatar } from '../ui/EmptyState';
import { Spinner } from '../ui/Spinner';

/** Connects the socket and keeps the query cache in sync with `message:new`. */
export function useChatSocket(): void {
  const token = useAuthStore((s) => s.token);
  const userId = useAuthStore((s) => s.user?.id);
  const qc = useQueryClient();

  useEffect(() => {
    if (!token || !userId) return;
    const socket = connectSocket(token);
    const onNew = (m: ChatHistory) => {
      const other = m.senderId === userId ? m.receiverId : m.senderId;
      qc.setQueryData<ChatHistory[]>(qk.messages(other), (old) =>
        old && !old.some((x) => x.id === m.id) ? [...old, m] : old,
      );
      void qc.invalidateQueries({ queryKey: qk.conversations });
    };
    socket.on('message:new', onNew);
    return () => {
      socket.off('message:new', onNew);
    };
  }, [token, userId, qc]);
}

export function ConnectionIndicator() {
  const status = useConnectionStore((s) => s.status);
  const connected = status === 'connected';
  return (
    <span data-testid="connection-status" className="inline-flex items-center gap-1.5 text-[11px] text-muted">
      <span className={cn('h-2 w-2 rounded-full', connected ? 'bg-sukses' : 'animate-pulse bg-primary')} />
      {connected ? 'Terhubung' : 'Menghubungkan ulang...'}
    </span>
  );
}

export function ConversationList({
  conversations,
  loading,
  activeId,
  pendingUser,
}: {
  conversations: ConversationSummary[];
  loading: boolean;
  activeId?: string;
  pendingUser?: PublicUser;
}) {
  const showPending = pendingUser && !conversations.some((c) => c.otherUser.id === pendingUser.id);
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[28px] border border-line/60 bg-surface/95 shadow-card backdrop-blur-sm">
      <div className="border-b border-line/60 px-5 py-4">
        <h1 className="text-base font-extrabold tracking-tight">Pesan</h1>
      </div>
      <ul className="flex-1 space-y-1 overflow-y-auto p-2.5" aria-label="Daftar percakapan">
        {loading && (
          <li className="flex justify-center p-6 text-muted">
            <Spinner />
          </li>
        )}
        {showPending && pendingUser && (
          <li>
            <Link to={`/chat/${pendingUser.id}`} className="flex items-center gap-3 rounded-2xl bg-accent/15 px-4 py-3">
              <Avatar name={pendingUser.nama} size={40} />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{pendingUser.nama}</p>
                <p className="truncate text-xs text-muted">Mulai percakapan baru</p>
              </div>
            </Link>
          </li>
        )}
        {!loading && conversations.length === 0 && !showPending && (
          <li className="p-6 text-center text-sm text-muted">Belum ada percakapan. Buka detail kos lalu tekan Chat Pemilik.</li>
        )}
        {conversations.map((c) => (
          <li key={c.otherUser.id}>
            <Link
              to={`/chat/${c.otherUser.id}`}
              data-testid="conversation-item"
              className={cn(
                'flex items-center gap-3 rounded-2xl px-4 py-3 transition hover:bg-bg/80',
                activeId === c.otherUser.id && 'bg-accent/15',
              )}
            >
              <Avatar name={c.otherUser.nama} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-bold">{c.otherUser.nama}</p>
                  <span className="shrink-0 text-[10px] text-muted">{formatTime(c.last.sentAt)}</span>
                </div>
                <p className="truncate text-xs text-muted">{c.last.pesan}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ChatRoom({ otherId, other }: { otherId: string; other?: PublicUser }) {
  const me = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const { data: messages = [], isLoading } = useMessages(otherId);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, otherId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pesan = text.trim();
    if (!pesan || sending) return;
    setSending(true);
    try {
      const sent = await sendChatMessage(otherId, pesan);
      setText('');
      qc.setQueryData<ChatHistory[]>(qk.messages(otherId), (old = []) =>
        old.some((m) => m.id === sent.id) ? old : [...old, sent],
      );
      void qc.invalidateQueries({ queryKey: qk.conversations });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[28px] border border-line/60 bg-surface/95 shadow-card backdrop-blur-sm">
      <header className="flex items-center gap-3 border-b border-line/60 px-5 py-3.5">
        <Link to="/chat" aria-label="Kembali ke daftar pesan" className="rounded-full p-1.5 hover:bg-bg md:hidden">
          <ArrowLeft size={18} />
        </Link>
        <Avatar name={other?.nama ?? '?'} size={38} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{other?.nama ?? 'Memuat...'}</p>
          <ConnectionIndicator />
        </div>
      </header>

      <div className="flex-1 space-y-2.5 overflow-y-auto bg-bg/45 p-4" data-testid="chat-messages">
        {isLoading && (
          <div className="flex justify-center py-6 text-muted">
            <Spinner />
          </div>
        )}
        {!isLoading && messages.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">Belum ada pesan. Sapa {other?.nama ?? 'pemilik'} sekarang!</p>
        )}
        {messages.map((m) => {
          const mine = m.senderId === me?.id;
          return (
            <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[80%] rounded-[22px] px-4 py-2.5 text-sm shadow-sm',
                  mine ? 'rounded-br-md bg-ink text-white' : 'rounded-bl-md border border-line/70 bg-surface text-ink',
                )}
              >
                <p className="whitespace-pre-wrap break-words">{m.pesan}</p>
                <p className={cn('mt-1 text-right text-[10px]', mine ? 'text-white/60' : 'text-muted')}>{formatTime(m.sentAt)}</p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="bg-surface px-4 pb-3.5 pt-2.5">
        <form
          onSubmit={(e) => void submit(e)}
          className="flex items-center gap-2 rounded-full border-2 border-line/80 bg-bg/60 py-1 pl-4 pr-1.5 transition focus-within:border-accent focus-within:bg-surface focus-within:shadow-sm"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
            aria-label="Tulis pesan"
            placeholder="Tulis pesan..."
            className="h-9 min-w-0 flex-1 bg-transparent text-sm focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Kirim pesan"
            disabled={!text.trim() || sending}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-tactile-primary transition hover:brightness-105 active:translate-y-[1px] active:shadow-none disabled:opacity-45 disabled:shadow-none"
          >
            {sending ? <Spinner className="h-4 w-4" /> : <Send size={15} />}
          </button>
        </form>
      </div>
    </div>
  );
}
