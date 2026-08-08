import { useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { Button } from './button';
import { isSoundEnabled, playNotificationSound, toggleSoundEnabled } from '@/lib/audio-alert';

export function SoundToggle({ className }: { className?: string }) {
  const [enabled, setEnabled] = useState(isSoundEnabled);

  const handleToggle = () => {
    const nextState = toggleSoundEnabled();
    setEnabled(nextState);
    if (nextState) {
      playNotificationSound('info');
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      className={className}
      title={enabled ? 'Mute Notification Sound' : 'Unmute Notification Sound'}
    >
      {enabled ? <Volume2 className="h-5 w-5 text-emerald-500" /> : <VolumeX className="h-5 w-5 text-muted-foreground" />}
    </Button>
  );
}
