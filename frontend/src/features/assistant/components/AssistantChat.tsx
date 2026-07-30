import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Loader2, MessageSquarePlus, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import type { UserRole } from '@/types';
import { useAssistantChat } from '../hooks/useAssistantChat';
import { AssistantMessageBubble } from './AssistantMessageBubble';

const suggestions: Record<UserRole, string[]> = {
  CITIZEN: [
    'How do I report an incident safely?',
    'What do my report statuses mean?',
    'What is the status of my reports?',
  ],
  OFFICER: [
    'What tasks are assigned to me?',
    'Explain the arrival and resolution workflow.',
    'How should treatment evidence be recorded?',
  ],
  ADMIN: [
    'Give me an incident status overview.',
    'Where can I review analytics and audit activity?',
    'What can the assistant access for administrators?',
  ],
};

const errorMessage = (error: unknown): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return 'I could not send that message. Please try again.';
};

interface AssistantChatProps {
  compact?: boolean;
  className?: string;
}

export function AssistantChat({ compact = false, className }: AssistantChatProps) {
  const { role } = useAuth();
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const {
    activeConversationId,
    setActiveConversationId,
    conversations,
    messages,
    send,
    startNewConversation,
  } = useAssistantChat();
  const prompts = useMemo(() => suggestions[role || 'CITIZEN'], [role]);
  const visibleMessages = messages.data || [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [visibleMessages.length, send.isPending]);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const value = draft.trim();
    if (!value || send.isPending) return;
    setDraft('');
    send.mutate(value);
  };

  return (
    <section
      aria-label="EcoAlert AI Assistant"
      className={cn('flex min-h-0 overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100', className)}
    >
      {!compact && (
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 md:flex md:flex-col">
          <Button variant="outline" className="mb-3 justify-start gap-2" onClick={startNewConversation}>
            <MessageSquarePlus className="h-4 w-4" /> New conversation
          </Button>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {conversations.isLoading && <p className="px-3 py-2 text-sm text-slate-500">Loading conversations…</p>}
            {conversations.data?.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => setActiveConversationId(conversation.id)}
                className={cn(
                  'w-full rounded-xl px-3 py-2 text-left text-sm transition-colors',
                  activeConversationId === conversation.id
                    ? 'bg-emerald-100 font-medium text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                )}
              >
                <span className="block truncate">{conversation.title}</span>
                <span className="mt-1 block text-xs font-normal text-slate-400">
                  {new Date(conversation.lastMessageAt).toLocaleDateString()}
                </span>
              </button>
            ))}
          </div>
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 sm:px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <Bot className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-semibold">EcoAlert AI Assistant</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Read-only guidance based on your authorized access</p>
            </div>
          </div>
          {compact && (
            <Button variant="ghost" size="sm" onClick={startNewConversation} title="Start a new conversation">
              <MessageSquarePlus className="mr-1 h-4 w-4" /> New
            </Button>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5">
          {messages.isLoading && activeConversationId ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading conversation…
            </div>
          ) : visibleMessages.length > 0 ? (
            <div className="mx-auto max-w-3xl space-y-5">
              {visibleMessages.map((message) => <AssistantMessageBubble key={message.id} message={message} />)}
              {send.isPending && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> EcoAlert AI is checking the approved context…
                </div>
              )}
              <div ref={endRef} />
            </div>
          ) : (
            <div className="mx-auto flex max-w-2xl flex-col items-center px-2 py-8 text-center sm:py-14">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                <Sparkles className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-semibold">How can I help with EcoAlert?</h2>
              <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500 dark:text-slate-400">
                I can explain reporting and workflow, or retrieve incident information that your signed-in role is allowed to view. I cannot make changes for you.
              </p>
              <div className="mt-6 flex w-full flex-wrap justify-center gap-2">
                {prompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setDraft(prompt)}
                    className="rounded-full border border-emerald-200 bg-white px-3 py-2 text-sm text-emerald-800 transition-colors hover:bg-emerald-50 dark:border-emerald-900/70 dark:bg-slate-900 dark:text-emerald-200 dark:hover:bg-emerald-950/40"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <form onSubmit={submit} className="border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:p-4">
          {send.isError && <p className="mb-2 text-sm text-red-600 dark:text-red-400">{errorMessage(send.error)}</p>}
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  submit();
                }
              }}
              maxLength={2000}
              rows={compact ? 2 : 3}
              placeholder="Ask about EcoAlert…"
              className="min-h-0 resize-none"
              aria-label="Ask EcoAlert AI Assistant"
            />
            <Button type="submit" size="icon" disabled={!draft.trim() || send.isPending} aria-label="Send message">
              {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="mx-auto mt-2 max-w-3xl text-xs text-slate-400">Use Enter to send; Shift+Enter for a new line. Do not include sensitive information you do not need to share.</p>
        </form>
      </div>
    </section>
  );
}
