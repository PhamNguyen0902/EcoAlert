import { useState } from 'react';
import { useUsers, useChangeRole, useToggleUserStatus, useDeleteUser } from '@/hooks/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Search, UserPlus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User } from '@/types';
import toast from 'react-hot-toast';
import { CreateUserModal } from '../components/CreateUserModal';
import { useLanguage } from '@/contexts/LanguageContext';

export default function UserManagement() {
  const { t } = useLanguage();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const { data, isLoading } = useUsers(page, 10, roleFilter, search);
  const changeRole = useChangeRole();
  const toggleStatus = useToggleUserStatus();
  const deleteUser = useDeleteUser();

  if (isLoading) return <LoadingSpinner />;

  const filteredUsers: User[] = data?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t('admin_users.title')}</h2>
          <p className="text-muted-foreground mt-1">{t('admin_users.subtitle')}</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="gap-2">
          <UserPlus className="h-4 w-4" /> {t('btn.create_user')}
        </Button>
      </div>

      <CreateUserModal open={isModalOpen} onOpenChange={setIsModalOpen} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>{t('nav.users')}</CardTitle>
          <div className="flex space-x-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder={t('btn.search')}
                className="w-[250px] pl-8"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('status.all')}</SelectItem>
                <SelectItem value="citizen">{t('admin_users.role_citizen')}</SelectItem>
                <SelectItem value="officer">{t('admin_users.role_officer')}</SelectItem>
                <SelectItem value="admin">{t('admin_users.role_admin')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="p-4 font-medium">{t('admin_users.col_name')}</th>
                  <th className="p-4 font-medium">{t('admin_users.col_email')}</th>
                  <th className="p-4 font-medium">{t('admin_users.col_role')}</th>
                  <th className="p-4 font-medium">{t('admin_users.col_status')}</th>
                  <th className="p-4 font-medium">{t('officer_reports.table_action')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user: User) => (
                  <tr key={user._id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="p-4">{user.fullName}</td>
                    <td className="p-4">{user.email}</td>
                    <td className="p-4 capitalize">{user.role}</td>
                    <td className="p-4">
                      <Badge variant={user.isActive ? 'default' : 'secondary'}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>{t('officer_reports.table_action')}</DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={async () => {
                              try {
                                await changeRole.mutateAsync({ id: user._id, role: 'ADMIN' });
                                toast.success(t('toast.role_updated_admin'));
                              } catch (err: any) {
                                toast.error(err.response?.data?.message || t('toast.role_update_failed'));
                              }
                            }}
                          >
                            {t('admin_users.role_admin')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={async () => {
                              try {
                                await changeRole.mutateAsync({ id: user._id, role: 'OFFICER' });
                                toast.success(t('toast.role_updated_officer'));
                              } catch (err: any) {
                                toast.error(err.response?.data?.message || t('toast.role_update_failed'));
                              }
                            }}
                          >
                            {t('admin_users.role_officer')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={async () => {
                              try {
                                await changeRole.mutateAsync({ id: user._id, role: 'CITIZEN' });
                                toast.success(t('toast.role_updated_citizen'));
                              } catch (err: any) {
                                toast.error(err.response?.data?.message || t('toast.role_update_failed'));
                              }
                            }}
                          >
                            {t('admin_users.role_citizen')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={async () => {
                              try {
                                await toggleStatus.mutateAsync({ id: user._id, isActive: !user.isActive });
                                toast.success(t('toast.account_status_updated'));
                              } catch (err: any) {
                                toast.error(err.response?.data?.message || t('toast.category_status_failed'));
                              }
                            }}
                          >
                            {user.isActive ? t('admin_officers.deactivate') : t('admin_officers.activate')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600 font-medium"
                            onClick={async () => {
                              if (confirm('Xóa người dùng?')) {
                                try {
                                  await deleteUser.mutateAsync(user._id);
                                  toast.success(t('toast.user_deleted_success'));
                                } catch (err: any) {
                                  toast.error(err.response?.data?.message || t('toast.category_delete_failed'));
                                }
                              }
                            }}
                          >
                            {t('btn.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-end space-x-2 py-4">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Trước</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)}>Tiếp</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
