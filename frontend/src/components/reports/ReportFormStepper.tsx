import { motion } from 'framer-motion';
import { Check, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ReportStep {
  id: number;
  label: string;
  icon: LucideIcon;
}

interface ReportFormStepperProps {
  currentStep: number;
  steps: ReportStep[];
}

export function ReportFormStepper({ currentStep, steps }: ReportFormStepperProps) {
  const activeStep = steps.find((step) => step.id === currentStep) ?? steps[0];
  const progress = steps.length > 1 ? ((currentStep - 1) / (steps.length - 1)) * 100 : 0;

  return (
    <nav aria-label="Report creation progress">
      <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 sm:hidden">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Step {currentStep} of {steps.length}</p>
          <p className="mt-0.5 font-semibold">{activeStep?.label}</p>
        </div>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{Math.round((currentStep / steps.length) * 100)}%</span>
      </div>

      <ol className="relative hidden grid-cols-4 gap-2 sm:grid">
        <div className="absolute left-[12.5%] right-[12.5%] top-5 h-px bg-border" aria-hidden="true" />
        <motion.div
          aria-hidden="true"
          className="absolute left-[12.5%] top-5 h-px origin-left bg-primary"
          animate={{ width: `${progress * 0.75}%` }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
        />
        {steps.map((step) => {
          const StepIcon = step.icon;
          const isComplete = step.id < currentStep;
          const isCurrent = step.id === currentStep;

          return (
            <li key={step.id} className="relative z-10 flex flex-col items-center text-center">
              <span
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold shadow-sm transition-colors',
                  isComplete && 'border-primary bg-primary text-primary-foreground',
                  isCurrent && 'border-primary bg-card text-primary ring-4 ring-primary/10',
                  !isComplete && !isCurrent && 'border-border bg-card text-muted-foreground',
                )}
              >
                {isComplete ? <Check className="h-4 w-4" aria-label={`${step.label} complete`} /> : isCurrent ? step.id : <StepIcon className="h-4 w-4" aria-hidden="true" />}
              </span>
              <span className={cn('mt-2 text-xs font-medium', (isComplete || isCurrent) ? 'text-foreground' : 'text-muted-foreground')}>
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
