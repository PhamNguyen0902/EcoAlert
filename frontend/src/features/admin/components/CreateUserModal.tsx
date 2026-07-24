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

interface CreateUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultRole?: 'CITIZEN' | 'OFFICER' | 'ADMIN';
}

export function CreateUserModal({ open, onOpenChange, defaultRole = 'OFFICER' }: CreateUserModalProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<string>(defaultRole);

  const createUser = useCreateUser();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      toast.error('Vui lòng điền đầy đủ các thông tin bắt buộc');
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
      toast.success(`Đã tạo thành công tài khoản ${role}`);
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
      const errorText = validationErrors || serverMessage || err.message || 'Có lỗi xảy ra khi tạo tài khoản';
      toast.error(errorText);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Tạo tài khoản người dùng mới</DialogTitle>
          <DialogDescription>
            Khởi tạo thông tin người dùng hoặc cán bộ mới cho hệ thống EcoAlert.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Họ và tên *</label>
            <Input
              placeholder="Nguyễn Văn A"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Email *</label>
            <Input
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Mật khẩu *</label>
            <Input
              type="password"
              placeholder="Mật khẩu tối thiểu 6 ký tự"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Số điện thoại</label>
            <Input
              placeholder="0987654321"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Vai trò</label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn vai trò" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CITIZEN">Người dân (Citizen)</SelectItem>
                <SelectItem value="OFFICER">Cán bộ (Officer)</SelectItem>
                <SelectItem value="ADMIN">Quản trị viên (Admin)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={createUser.isPending}>
              {createUser.isPending ? 'Đang khởi tạo...' : 'Tạo tài khoản'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
