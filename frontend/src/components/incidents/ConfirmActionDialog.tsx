import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ConfirmActionDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel?: string;
  isPending?: boolean;
  destructive?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  children?: React.ReactNode;
}

export function ConfirmActionDialog({
  open,
  title,
  description,
  confirmLabel,
  pendingLabel = 'Saving...',
  isPending = false,
  destructive = false,
  onOpenChange,
  onConfirm,
  children,
}: ConfirmActionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !isPending && onOpenChange(nextOpen)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isPending ? pendingLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
