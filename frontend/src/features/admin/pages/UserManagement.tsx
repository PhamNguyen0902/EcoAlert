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

export default function UserManagement() {
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
        <h2 className="text-3xl font-bold tracking-tight">Quản lý Người dùng</h2>
        <Button onClick={() => setIsModalOpen(true)} className="gap-2">
          <UserPlus className="h-4 w-4" /> Tạo người dùng mới
        </Button>
      </div>

      <CreateUserModal open={isModalOpen} onOpenChange={setIsModalOpen} />

      <Card>

        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Users</CardTitle>
          <div className="flex space-x-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search users..."
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
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="citizen">Citizen</SelectItem>
                <SelectItem value="officer">Officer</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="p-4 font-medium">Name</th>
                  <th className="p-4 font-medium">Email</th>
                  <th className="p-4 font-medium">Role</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium">Actions</th>
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
                          <DropdownMenuLabel>Hành động</DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={async () => {
                              try {
                                await changeRole.mutateAsync({ id: user._id, role: 'ADMIN' });
                                toast.success('Đã cập nhật vai trò: Quản trị viên (Admin)');
                              } catch (err: any) {
                                toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi đổi vai trò');
                              }
                            }}
                          >
                            Đổi thành Admin
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={async () => {
                              try {
                                await changeRole.mutateAsync({ id: user._id, role: 'OFFICER' });
                                toast.success('Đã cập nhật vai trò: Cán bộ (Officer)');
                              } catch (err: any) {
                                toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi đổi vai trò');
                              }
                            }}
                          >
                            Đổi thành Cán bộ (Officer)
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={async () => {
                              try {
                                await changeRole.mutateAsync({ id: user._id, role: 'CITIZEN' });
                                toast.success('Đã cập nhật vai trò: Người dân (Citizen)');
                              } catch (err: any) {
                                toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi đổi vai trò');
                              }
                            }}
                          >
                            Đổi thành Người dân (Citizen)
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={async () => {
                              try {
                                await toggleStatus.mutateAsync({ id: user._id, isActive: !user.isActive });
                                toast.success(`Đã ${!user.isActive ? 'kích hoạt' : 'khóa'} tài khoản`);
                              } catch (err: any) {
                                toast.error(err.response?.data?.message || 'Có lỗi xảy ra');
                              }
                            }}
                          >
                            {user.isActive ? 'Khóa tài khoản' : 'Kích hoạt tài khoản'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600 font-medium"
                            onClick={async () => {
                              if (confirm('Bạn có chắc chắn muốn xóa người dùng này?')) {
                                try {
                                  await deleteUser.mutateAsync(user._id);
                                  toast.success('Đã xóa người dùng');
                                } catch (err: any) {
                                  toast.error(err.response?.data?.message || 'Có lỗi xảy ra');
                                }
                              }
                            }}
                          >
                            Xóa người dùng
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
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
