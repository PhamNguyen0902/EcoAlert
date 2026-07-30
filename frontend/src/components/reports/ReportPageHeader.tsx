import { ShieldCheck } from 'lucide-react';

interface ReportPageHeaderProps {
  title: string;
  description: string;
  privacyNote: string;
}

export function ReportPageHeader({ title, description, privacyNote }: ReportPageHeaderProps) {
  return (
    <header className="border-b border-border/80 pb-6 sm:pb-7">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>
          <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span>{privacyNote}</span>
          </p>
        </div>
      </div>
    </header>
  );
}
