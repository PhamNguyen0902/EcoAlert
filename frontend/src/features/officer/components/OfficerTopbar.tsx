import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, Search, LogOut, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUnreadCount } from '@/hooks/hooks';
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
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const { data: unreadCount = 0 } = useUnreadCount();

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('dashboard')) return t('officer.dashboard');
    if (path.includes('assigned')) return t('officer.assigned');
    if (path.includes('pending')) return t('officer.pending');
    if (path.includes('map')) return t('officer.map');
    if (path.includes('notifications')) return t('officer.notifications');
    if (path.includes('stats')) return t('officer.stats');
    if (path.includes('reports/')) return t('officer.details');
    return 'Officer Portal';
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

        <ThemeToggle />

        <button 
          onClick={() => navigate('/officer/notifications')}
          className="relative p-2 text-muted-foreground hover:bg-muted hover:text-foreground rounded-full transition-colors"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-destructive rounded-full" />
          )}
        </button>

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
            <DropdownMenuItem onClick={() => navigate('/officer/profile')}>
              <UserIcon className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={logout}>
              <LogOut className="mr-2 h-4 w-4 text-destructive" />
              <span className="text-destructive">Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
