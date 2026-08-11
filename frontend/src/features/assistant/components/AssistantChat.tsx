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
    'Làm thế nào để báo cáo sự cố an toàn?',
    'Trạng thái báo cáo của tôi có ý nghĩa gì?',
    'Trạng thái các báo cáo của tôi hiện tại ra sao?',
    'Tôi nên làm gì tiếp theo với báo cáo mới nhất?',
  ],
  OFFICER: [
    'Tôi có những nhiệm vụ nào được giao?',
    'Giải thích quy trình tiếp nhận và xử lý sự cố.',
    'Hình ảnh minh chứng xử lý cần được ghi nhận như thế nào?',
    'Tôi nên làm gì tiếp theo với sự cố được giao?',
  ],
  ADMIN: [
    'Tóm tắt trạng thái các sự cố cho tôi.',
    'Tôi có thể xem phân tích và nhật ký hoạt động ở đâu?',
    'Trợ lý AI có thể truy cập những gì cho quản trị viên?',
    'Tôi nên làm gì tiếp theo với mật độ sự cố và khối lượng công việc?',
  ],
};

const errorMessage = (error: unknown): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return 'Không thể gửi tin nhắn. Vui lòng thử lại.';
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
      aria-label="Trợ lý AI EcoAlert"
      className={cn('flex min-h-0 overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100', className)}
    >
      {!compact && (
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 md:flex md:flex-col">
          <Button variant="outline" className="mb-3 justify-start gap-2" onClick={startNewConversation}>
            <MessageSquarePlus className="h-4 w-4" /> Cuộc trò chuyện mới
          </Button>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {conversations.isLoading && <p className="px-3 py-2 text-sm text-slate-500">Đang tải cuộc trò chuyện…</p>}
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
              <h1 className="font-semibold">Trợ lý AI EcoAlert</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Hướng dẫn chỉ đọc dựa trên quyền truy cập được cấp</p>
            </div>
          </div>
          {compact && (
            <Button variant="ghost" size="sm" onClick={startNewConversation} title="Tạo cuộc trò chuyện mới">
              <MessageSquarePlus className="mr-1 h-4 w-4" /> Tạo mới
            </Button>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5">
          {messages.isLoading && activeConversationId ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang tải cuộc trò chuyện…
            </div>
          ) : visibleMessages.length > 0 ? (
            <div className="mx-auto max-w-3xl space-y-5">
              {visibleMessages.map((message) => <AssistantMessageBubble key={message.id} message={message} />)}
              {send.isPending && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> EcoAlert AI đang kiểm tra ngữ cảnh được phép…
                </div>
              )}
              <div ref={endRef} />
            </div>
          ) : (
            <div className="mx-auto flex max-w-2xl flex-col items-center px-2 py-8 text-center sm:py-14">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                <Sparkles className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-semibold">Tôi có thể giúp gì cho bạn với EcoAlert?</h2>
              <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500 dark:text-slate-400">
                Tôi có thể giải thích quy trình báo cáo và xử lý, hoặc truy xuất thông tin sự cố mà vai trò của bạn được phép xem. Tôi không thể thực hiện thay đổi giúp bạn.
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
              placeholder="Hỏi về EcoAlert…"
              className="min-h-0 resize-none"
              aria-label="Hỏi Trợ lý AI EcoAlert"
            />
            <Button type="submit" size="icon" disabled={!draft.trim() || send.isPending} aria-label="Gửi tin nhắn">
              {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="mx-auto mt-2 max-w-3xl text-xs text-slate-400">Nhấn Enter để gửi; Shift+Enter để xuống dòng. Không nhập thông tin nhạy cảm không cần thiết.</p>
        </form>
      </div>
    </section>
  );
}
