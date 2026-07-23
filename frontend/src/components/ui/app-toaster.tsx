import { Toaster } from 'react-hot-toast';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * AppToaster - Toaster đồng bộ với light/dark theme của EcoAlert.
 * Dùng component này thay cho <Toaster /> ở mọi layout.
 */
export function AppToaster() {
  const { isDark } = useTheme();

  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 1500,
        className: isDark
          ? '!bg-slate-900 !text-slate-100 !border-slate-800 !border !shadow-2xl'
          : '!bg-white !text-slate-900 !border-slate-200 !border !shadow-lg',
        style: {
          borderRadius: '10px',
          fontSize: '14px',
          padding: '12px 16px',
        },
        success: {
          duration: 1500,
          iconTheme: {
            primary: '#22c55e',
            secondary: isDark ? '#0f172a' : '#ffffff',
          },
        },
        error: {
          duration: 3000,
          iconTheme: {
            primary: '#ef4444',
            secondary: isDark ? '#0f172a' : '#ffffff',
          },
        },
      }}
    />
  );
}

