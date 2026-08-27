import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Loader2, Map, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
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
  const { language } = useLanguage();
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
  const text = language === 'vi'
    ? {
      openMap: 'Mở vị trí đã chọn trên Google Maps', viewMap: 'Xem trên Google Maps',
      navigate: 'Chỉ đường đến vị trí đã chọn', startNavigation: 'Bắt đầu chỉ đường',
      copy: 'Sao chép tọa độ', copied: 'Đã sao chép', copyCoords: 'Sao chép tọa độ',
    }
    : {
      openMap: 'Open selected location in Google Maps', viewMap: 'View on Google Maps',
      navigate: 'Navigate to selected location', startNavigation: 'Start navigation',
      copy: 'Copy coordinates', copied: 'Copied', copyCoords: 'Copy coords',
    };

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
        aria-label={text.openMap}
        title="Google Maps"
      >
        <Map className="h-4 w-4" />
        <span className="ml-2">{isCompact ? 'Google Maps' : text.viewMap}</span>
      </Button>

      {showNavigation ? (
        <Button
          type="button"
          variant={isCompact ? 'outline' : 'default'}
          size={isCompact ? 'sm' : 'default'}
          className={buttonClassName}
          onClick={() => startGoogleMapsNavigation(latitude, longitude)}
          disabled={!hasCoordinates}
          aria-label={text.navigate}
          title={text.startNavigation}
        >
          <Navigation className="h-4 w-4" />
          <span className="ml-2">{isCompact ? text.startNavigation : text.startNavigation}</span>
        </Button>
      ) : null}

      <Button
        type="button"
        variant="outline"
        size={isCompact ? 'sm' : 'default'}
        className={buttonClassName}
        onClick={handleCopy}
        disabled={!hasCoordinates || isCopying}
        aria-label={text.copy}
        title={text.copy}
      >
        {isCopying ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : copied ? (
          <Check className="h-4 w-4 text-primary" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
        <span className="ml-2">{copied ? text.copied : isCompact ? text.copyCoords : text.copy}</span>
      </Button>
    </div>
  );
}
