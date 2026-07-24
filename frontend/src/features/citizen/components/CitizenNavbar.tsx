import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Leaf, Bell, Menu, X, User, LogOut, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUnreadCount } from '@/hooks/hooks';
import { Badge } from '@/components/ui/badge';

export default function CitizenNavbar() {
  const { user, logout, isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { data: unreadCount = 0 } = useUnreadCount();

  const navLinks = [
    { name: t('nav.home'), path: '/home' },
    { name: t('nav.report_incident'), path: '/report' },
    { name: t('nav.my_reports'), path: '/my-reports' },
  ];

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center gap-2">
            <Link to="/home" className="flex items-center gap-2 group">
              <div className="bg-green-500/10 p-2 rounded-xl group-hover:bg-green-500/20 transition-colors">
                <Leaf className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-green-600 to-emerald-500 dark:from-green-400 dark:to-emerald-300">
                EcoAlert
              </span>
            </Link>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = location.pathname.startsWith(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 relative",
                    isActive 
                      ? "text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20" 
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50"
                  )}
                >
                  {link.name}
                </Link>
              );
            })}
          </nav>

          {/* Right side actions */}
          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" size="icon" className="relative" asChild>
              <Link to="/notifications">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <Badge 
                    className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] bg-red-500 text-white border-2 border-white dark:border-slate-900"
                    variant="destructive"
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Badge>
                )}
                <span className="sr-only">Notifications</span>
              </Link>
            </Button>
            
            <ThemeToggle />

            {isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-10 w-10 border-2 border-transparent hover:border-green-500/50 transition-colors">
                      <AvatarImage src={user.avatar} alt={user.fullName} />
                      <AvatarFallback className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">
                        {getInitials(user.fullName)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.fullName}</p>
                      <p className="text-xs leading-none text-slate-500 dark:text-slate-400">
                        {user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="cursor-pointer flex items-center">
                      <User className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="text-red-600 focus:text-red-600 dark:text-red-400 focus:dark:text-red-400 cursor-pointer flex items-center">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button asChild variant="default" className="bg-green-600 hover:bg-green-700 text-white rounded-full">
                <Link to="/login">Sign In</Link>
              </Button>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden items-center gap-2">
            <Button variant="ghost" size="icon" className="relative" asChild>
              <Link to="/notifications">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-white dark:border-slate-900" />
                )}
              </Link>
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="md:hidden overflow-hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
          >
            <div className="px-4 pt-2 pb-6 space-y-1">
              {navLinks.map((link) => {
                const isActive = location.pathname.startsWith(link.path);
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      "block px-3 py-3 rounded-xl text-base font-medium transition-colors",
                      isActive
                        ? "text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    )}
                  >
                    {link.name}
                  </Link>
                );
              })}
              
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-4 px-3">
                  <span className="text-sm font-medium text-slate-500">Theme</span>
                  <ThemeToggle />
                </div>
                
                {isAuthenticated && user ? (
                  <div className="space-y-1">
                    <Link
                      to="/profile"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center px-3 py-3 rounded-xl text-base font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <User className="mr-3 h-5 w-5 text-slate-400" />
                      Profile
                    </Link>
                    <button
                      onClick={() => {
                        logout();
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center px-3 py-3 rounded-xl text-base font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10"
                    >
                      <LogOut className="mr-3 h-5 w-5 text-red-400" />
                      Log out
                    </button>
                  </div>
                ) : (
                  <Button asChild className="w-full bg-green-600 hover:bg-green-700 text-white rounded-xl">
                    <Link to="/login" onClick={() => setIsMobileMenuOpen(false)}>Sign In</Link>
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
