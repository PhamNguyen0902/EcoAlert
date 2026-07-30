import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AssistantChat } from './AssistantChat';

export function AssistantLauncher() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  if (location.pathname === '/assistant') return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        size="icon"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 h-12 w-12 rounded-2xl bg-emerald-600 shadow-lg shadow-emerald-900/20 hover:bg-emerald-700"
        aria-label="Open EcoAlert AI Assistant"
        title="EcoAlert AI Assistant"
      >
        <Bot className="h-6 w-6" />
      </Button>
      <DialogContent className="h-[min(720px,calc(100vh-2rem))] max-w-2xl gap-0 overflow-hidden p-0 sm:rounded-2xl" aria-describedby={undefined}>
        <AssistantChat compact className="h-full" />
      </DialogContent>
    </Dialog>
  );
}
