import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Loader2, Map, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  copyCoordinates,
  hasValidCoordinates,
  openGoogleMaps,
  startGoogleMapsNavigation,
} from '@/lib/maps';

interface LocationActionsProps {
  latitude?: number;
  longitude?: number;
  presentation?: 'full' | 'compact';
  showNavigation?: boolean;
  className?: string;
}

export function LocationActions({
  latitude,
  longitude,
  presentation = 'full',
  showNavigation = true,
  className,
}: LocationActionsProps) {
  const [copied, setCopied] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const resetCopyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasCoordinates = hasValidCoordinates(latitude, longitude);

  useEffect(() => {
    return () => {
      if (resetCopyTimer.current) {
        clearTimeout(resetCopyTimer.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    setIsCopying(true);
    const didCopy = await copyCoordinates(latitude, longitude);
    setIsCopying(false);
    if (!didCopy) {
      return;
    }

    setCopied(true);
    if (resetCopyTimer.current) {
      clearTimeout(resetCopyTimer.current);
    }
    resetCopyTimer.current = setTimeout(() => setCopied(false), 2_000);
  };

  const isCompact = presentation === 'compact';
  const buttonClassName = isCompact
    ? 'justify-start rounded-xl bg-background/95 px-3 text-xs shadow-lg backdrop-blur'
    : 'w-full';

  return (
    <div
      className={cn(
        isCompact ? 'flex flex-col gap-2' : 'grid grid-cols-1 gap-2',
        className,
      )}
    >
      <Button
        type="button"
        variant="outline"
        size={isCompact ? 'sm' : 'default'}
        className={buttonClassName}
        onClick={() => openGoogleMaps(latitude, longitude)}
        disabled={!hasCoordinates}
        aria-label="Open selected location in Google Maps"
        title="Google Maps"
      >
        <Map className="h-4 w-4" />
        <span className="ml-2">{isCompact ? 'Google Maps' : 'View on Google Maps'}</span>
      </Button>

      {showNavigation ? (
        <Button
          type="button"
          variant={isCompact ? 'outline' : 'default'}
          size={isCompact ? 'sm' : 'default'}
          className={buttonClassName}
          onClick={() => startGoogleMapsNavigation(latitude, longitude)}
          disabled={!hasCoordinates}
          aria-label="Navigate to selected location"
          title="Navigate"
        >
          <Navigation className="h-4 w-4" />
          <span className="ml-2">{isCompact ? 'Navigate' : 'Start Navigation'}</span>
        </Button>
      ) : null}

      <Button
        type="button"
        variant="outline"
        size={isCompact ? 'sm' : 'default'}
        className={buttonClassName}
        onClick={handleCopy}
        disabled={!hasCoordinates || isCopying}
        aria-label="Copy coordinates"
        title="Copy coordinates"
      >
        {isCopying ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : copied ? (
          <Check className="h-4 w-4 text-primary" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
        <span className="ml-2">{copied ? 'Copied' : isCompact ? 'Copy coords' : 'Copy Coordinates'}</span>
      </Button>
    </div>
  );
}
