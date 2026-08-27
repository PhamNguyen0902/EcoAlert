import { useLocation } from 'react-router-dom';
import { Search, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { LanguageToggle } from '@/components/ui/language-toggle';
import { SoundToggle } from '@/components/ui/sound-toggle';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function OfficerTopbar() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { t, language } = useLanguage();

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('assigned')) return t('officer.assigned');
    if (path.includes('map')) return t('officer.map');
    if (path.includes('reports/')) return t('officer.details');
    return language === 'vi' ? 'Cổng cán bộ' : 'Officer Portal';
  };

  return (
    <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between z-10 shrink-0">
      <h1 className="text-xl font-semibold text-foreground">{getPageTitle()}</h1>

      <div className="flex items-center gap-4">
        <div className="relative hidden md:flex items-center">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('btn.search')}
            className="h-9 w-64 rounded-md border border-input bg-transparent px-9 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <SoundToggle />
        <LanguageToggle />
        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger className="focus:outline-none">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.avatar} />
              <AvatarFallback>{user?.fullName?.charAt(0) || 'U'}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.fullName}</p>
                <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout}>
              <LogOut className="mr-2 h-4 w-4 text-destructive" />
              <span className="text-destructive">{language === 'vi' ? 'Đăng xuất' : 'Log out'}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
