import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateUser } from '@/hooks/hooks';
import toast from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';

interface CreateUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultRole?: 'CITIZEN' | 'OFFICER' | 'ADMIN';
}

export function CreateUserModal({ open, onOpenChange, defaultRole = 'OFFICER' }: CreateUserModalProps) {
  const { t } = useLanguage();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<string>(defaultRole);

  const createUser = useCreateUser();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      toast.error(t('toast.fill_required_fields'));
      return;
    }

    try {
      await createUser.mutateAsync({
        fullName,
        email,
        password,
        phone: phone || undefined,
        role: role.toUpperCase(),
      });
      toast.success(t('toast.create_account_success'));
      onOpenChange(false);
      setFullName('');
      setEmail('');
      setPassword('');
      setPhone('');
    } catch (err: any) {
      console.error('Lỗi khởi tạo người dùng:', err);
      const serverMessage = err.response?.data?.message || err.response?.data?.error;
      const validationErrors = Array.isArray(err.response?.data?.errors) && err.response?.data?.errors.length > 0
        ? err.response?.data?.errors.join(', ')
        : null;
      const errorText = validationErrors || serverMessage || err.message || t('toast.create_account_failed');
      toast.error(errorText);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('admin_users.create_title')}</DialogTitle>
          <DialogDescription>
            {t('admin_users.subtitle')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-muted-foreground">{t('auth.full_name')} *</label>
            <Input
              placeholder="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-muted-foreground">{t('auth.email')} *</label>
            <Input
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-muted-foreground">{t('auth.password')} *</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-muted-foreground">{t('auth.phone')}</label>
            <Input
              placeholder="0987654321"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-muted-foreground">{t('admin_users.col_role')}</label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CITIZEN">{t('admin_users.role_citizen')}</SelectItem>
                <SelectItem value="OFFICER">{t('admin_users.role_officer')}</SelectItem>
                <SelectItem value="ADMIN">{t('admin_users.role_admin')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('btn.cancel')}
            </Button>
            <Button type="submit" disabled={createUser.isPending}>
              {createUser.isPending ? '...' : t('btn.create_user')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
