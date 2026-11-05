import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowUp, Sparkles, X } from 'lucide-react';
import { useChatbotAsk, useLogin } from '../../api/hooks';
import { errorMessage } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { useChatbotStore } from '../../stores/chatbotStore';
import { toast } from '../../stores/toastStore';
import { MessageBubble, ResultCard, TypingIndicator } from './MessageParts';

let idCounter = 0;
const nextId = () => `m${++idCounter}`;

const QUICK_PROMPTS = [
  'Cari kos dekat UI budget 2 juta',
  'Kos putri dekat Binus budget 1.5 jt',
  'Dekat Stasiun Sudirman, ojek di bawah 15rb',
];

export function ChatbotOverlay() {
  const { open, messages, pending, closePanel, openPanel, addMessage, setPending } = useChatbotStore();
  const token = useAuthStore((s) => s.token);
  const [params, setParams] = useSearchParams();
  const ask = useChatbotAsk();
  const login = useLogin();
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // After login-redirect (?chatbot=1) open the panel automatically.
  useEffect(() => {
    if (params.get('chatbot') === '1') {
      openPanel();
      const next = new URLSearchParams(params);
      next.delete('chatbot');
      setParams(next, { replace: true });
    }
  }, [params, openPanel, setParams]);

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

  const sendPrompt = async (rawText: string) => {
    const message = rawText.trim();
    if (!message || pending) return;
    setText('');
    addMessage({ id: nextId(), role: 'user', text: message });
    setPending(true);
    try {
      if (!token) {
        await login.mutateAsync({ email: 'tenant@kosmatch.test', password: 'password123' });
      }
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

  const send = () => sendPrompt(text);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        id="floating-chatbot-trigger"
        data-testid="floating-chatbot-trigger"
        onClick={openPanel}
        aria-label="Buka KosMatch AI Chatbot"
        className="group fixed bottom-5 right-5 z-40 flex items-center gap-3 rounded-full border-2 border-white/30 bg-accent py-2.5 pl-3 pr-5 text-white shadow-tactile-accent transition-[transform,filter] duration-150 hover:-translate-y-0.5 hover:brightness-105 active:translate-y-[2px] active:shadow-none sm:bottom-6 sm:right-6"
      >
        <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/20 shadow-inner transition-transform duration-200 group-hover:scale-105">
          <Sparkles size={19} />
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-accent bg-sukses" />
        </span>
        <span className="text-left leading-tight">
          <span className="block text-xs font-extrabold tracking-tight sm:text-sm">KosMatch AI</span>
          <span className="block text-[10px] font-medium text-white/90 sm:text-[11px]">Tanya rekomendasi kos</span>
        </span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end sm:p-3">
      <div data-testid="chatbot-backdrop" className="absolute inset-0 animate-fade-in bg-ink/35 backdrop-blur-[3px]" onClick={closePanel} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="KosMatch AI"
        data-testid="chatbot-panel"
        className="relative flex h-full w-full animate-slide-in-right flex-col overflow-hidden bg-surface shadow-float sm:w-[410px] sm:rounded-[32px] sm:border sm:border-line/70"
      >
        <header data-testid="chatbot-header" className="flex shrink-0 items-center justify-between bg-accent px-5 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 shadow-inner">
              <Sparkles size={17} />
            </span>
            <div>
              <h2 className="text-sm font-extrabold tracking-tight">KosMatch AI</h2>
              <p className="text-[11px] text-white/85">Asisten pintar pencari kos</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Tutup chatbot"
            onClick={closePanel}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition hover:bg-white/25"
          >
            <X size={17} />
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 space-y-3.5 overflow-y-auto bg-bg/45 p-4" data-testid="chatbot-messages">
          {messages.map((m) => (
            <div key={m.id} className="space-y-2.5">
              <MessageBubble role={m.role}>
                {m.noResults && <strong className="mb-1 block text-sm">Kos Tidak Ditemukan</strong>}
                {m.text}
              </MessageBubble>
              {m.results?.map((r) => (
                <ResultCard key={r.kos.id} item={r} destinationId={m.destinationId} onNavigate={closePanel} />
              ))}
            </div>
          ))}

          {messages.length === 1 && !pending && (
            <div className="space-y-1.5 pt-1">
              <p className="px-1 text-[11px] font-semibold text-muted">Coba tanya cepat:</p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => void sendPrompt(q)}
                    className="rounded-full border border-accent/35 bg-surface px-3 py-1.5 text-left text-[11px] font-semibold text-ink shadow-sm transition hover:border-accent hover:bg-accent/10"
                  >
                    ✨ {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {pending && <TypingIndicator />}
        </div>

        <footer className="shrink-0 bg-surface px-4 pb-3.5 pt-2.5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="flex items-end gap-2 rounded-full border-2 border-line/80 bg-bg/60 py-1.5 pl-4 pr-1.5 transition focus-within:border-accent focus-within:bg-surface focus-within:shadow-sm"
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
              className="max-h-24 min-h-[28px] flex-1 resize-none bg-transparent py-1 text-xs text-ink placeholder:text-muted/70 focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Kirim pesan"
              disabled={!text.trim() || pending}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-tactile-primary transition hover:brightness-105 active:translate-y-[1px] active:shadow-none disabled:opacity-45 disabled:shadow-none"
            >
              <ArrowUp size={17} strokeWidth={2.5} />
            </button>
          </form>
          <p className="mt-2 text-center text-[10px] text-muted">Estimasi dapat berubah. Mohon verifikasi sebelum memutuskan.</p>
        </footer>
      </aside>
    </div>
  );
}
