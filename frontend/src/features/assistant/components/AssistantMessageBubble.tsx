import { Link } from 'react-router-dom';
import { Bot, ExternalLink, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AssistantMessage } from '@/types';

export function AssistantMessageBubble({ message }: { message: AssistantMessage }) {
  const isAssistant = message.role === 'ASSISTANT';

  return (
    <div className={cn('flex gap-3', isAssistant ? 'justify-start' : 'justify-end')}>
      {isAssistant && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
          <Bot className="h-4 w-4" aria-hidden="true" />
        </div>
      )}
      <div className={cn('max-w-[86%] space-y-2', !isAssistant && 'items-end')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm whitespace-pre-wrap',
            isAssistant
              ? 'rounded-tl-md border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
              : 'rounded-tr-md bg-emerald-600 text-white',
          )}
        >
          {message.content}
        </div>
        {isAssistant && message.sources.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {message.sources.map((source) => (
              <Link
                key={source.id}
                to={source.href || '/assistant'}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 transition-colors hover:bg-emerald-100 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-200"
              >
                <span className="truncate">{source.title}</span>
                <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
              </Link>
            ))}
          </div>
        )}
      </div>
      {!isAssistant && (
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200">
          <UserRound className="h-4 w-4" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
