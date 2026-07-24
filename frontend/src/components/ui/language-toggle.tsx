import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';

export function LanguageToggle({ className }: { className?: string }) {
  const { language, toggleLanguage } = useLanguage();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleLanguage}
      className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-full shadow-lg bg-background/90 backdrop-blur-md border border-border hover:bg-accent hover:text-accent-foreground transition-all duration-200 ${className || ''}`}
      title="Đổi ngôn ngữ / Switch Language"
    >
      <Globe className="h-4 w-4 text-emerald-500" />
      <span>{language === 'vi' ? 'Tiếng Việt (VI)' : 'English (EN)'}</span>
    </Button>
  );
}

export function FloatingLanguageToggle() {
  return (
    <div className="fixed bottom-5 left-5 z-[9999]">
      <LanguageToggle />
    </div>
  );
}
