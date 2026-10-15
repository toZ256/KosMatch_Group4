import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUp, X } from 'lucide-react';
import { useChatbotAsk } from '../../api/hooks';
import { errorMessage } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { useChatbotStore } from '../../stores/chatbotStore';
import { toast } from '../../stores/toastStore';
import { MessageBubble, ResultCard, TypingIndicator } from './MessageParts';

let idCounter = 0;
const nextId = () => `m${++idCounter}`;

export function ChatbotOverlay() {
  const { open, messages, pending, closePanel, openPanel, addMessage, setPending } = useChatbotStore();
  const token = useAuthStore((s) => s.token);
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const ask = useChatbotAsk();
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // After login-redirect (?chatbot=1) open the panel automatically.
  useEffect(() => {
    if (params.get('chatbot') === '1' && token) {
      openPanel();
      const next = new URLSearchParams(params);
      next.delete('chatbot');
      setParams(next, { replace: true });
    }
  }, [params, token, openPanel, setParams]);

  // Session lost while open: send the user to login and come back to the chatbot.
  useEffect(() => {
    if (open && !token) {
      closePanel();
      navigate(`/login?redirect=${encodeURIComponent(location.pathname + '?chatbot=1')}`);
    }
  }, [open, token, closePanel, navigate, location.pathname]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending, open]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && closePanel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closePanel]);

  if (!open) return null;

  const send = async () => {
    const message = text.trim();
    if (!message || pending) return;
    setText('');
    addMessage({ id: nextId(), role: 'user', text: message });
    setPending(true);
    try {
      const res = await ask.mutateAsync(message);
      addMessage({
        id: nextId(),
        role: 'bot',
        text: res.reply,
        results: res.results,
        noResults: res.noResults,
        destinationId: res.params.destinationId,
      });
    } catch (e) {
      toast.error(errorMessage(e));
      addMessage({ id: nextId(), role: 'bot', text: `Maaf, terjadi kendala: ${errorMessage(e)}`, isError: true });
    } finally {
      setPending(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div data-testid="chatbot-backdrop" className="absolute inset-0 animate-fade-in bg-black/40 backdrop-blur-[2px]" onClick={closePanel} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="KosMatch AI"
        data-testid="chatbot-panel"
        className="relative flex h-full w-full animate-slide-in-right flex-col bg-surface shadow-2xl sm:w-[400px]"
      >
        <header data-testid="chatbot-header" className="flex h-16 shrink-0 items-center justify-between bg-accent px-5 text-white">
          <h2 className="text-sm font-bold">KosMatch AI</h2>
          <button type="button" aria-label="Tutup chatbot" onClick={closePanel} className="rounded-full p-1.5 hover:bg-white/15">
            <X size={18} />
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4" data-testid="chatbot-messages">
          {messages.map((m) => (
            <div key={m.id} className="space-y-2">
              <MessageBubble role={m.role}>
                {m.noResults && <strong className="mb-1 block text-sm">Kos Tidak Ditemukan</strong>}
                {m.text}
              </MessageBubble>
              {m.results?.map((r) => (
                <ResultCard key={r.kos.id} item={r} destinationId={m.destinationId} onNavigate={closePanel} />
              ))}
            </div>
          ))}
          {pending && <TypingIndicator />}
        </div>

        <footer className="shrink-0 border-t border-line bg-surface p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="flex items-end gap-2"
          >
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              maxLength={500}
              aria-label="Pesan untuk KosMatch AI"
              placeholder="Ketik pesan kamu..."
              className="max-h-28 min-h-[40px] flex-1 resize-none rounded-3xl border border-line bg-surface px-4 py-2.5 text-xs text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Kirim pesan"
              disabled={!text.trim() || pending}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white transition hover:brightness-95 disabled:opacity-50"
            >
              <ArrowUp size={18} />
            </button>
          </form>
          <p className="mt-2 text-center text-[10px] text-muted">Estimasi dapat berubah. Mohon verifikasi sebelum memutuskan.</p>
        </footer>
      </aside>
    </div>
  );
}
