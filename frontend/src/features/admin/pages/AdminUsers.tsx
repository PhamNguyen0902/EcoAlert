import { useState } from "react";
import {
  ShieldCheck,
  Users,
  Search,
  Filter,
  MoreHorizontal,
  Check,
  Ban,
  UserCheck,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  useAdminUsers,
  useUpdateUserRole,
  useToggleUserStatus,
} from "@/hooks/useAdminDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { User } from "@/types";

// Trang Quản lý Thành viên & Phân quyền độc lập (/admin/users)
export default function AdminUsers() {
  const [userPage, setUserPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");

  const { data: userData, isLoading: isUsersLoading } = useAdminUsers({
    page: userPage,
    limit: 10,
    role: roleFilter,
    search: searchTerm,
  });

  const updateRoleMutation = useUpdateUserRole();
  const toggleStatusMutation = useToggleUserStatus();

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await updateRoleMutation.mutateAsync({ userId, role: newRole });
      toast.success(`Đã cập nhật vai trò sang ${newRole}`);
    } catch {
      toast.error("Không thể cập nhật quyền người dùng");
    }
  };

  const handleStatusToggle = async (userId: string, currentStatus: boolean) => {
    try {
      await toggleStatusMutation.mutateAsync({
        userId,
        isActive: !currentStatus,
      });
      toast.success(
        currentStatus ? "Đã khóa tài khoản" : "Đã kích hoạt lại tài khoản",
      );
    } catch {
      toast.error("Không thể đổi trạng thái tài khoản");
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-2 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-3xl font-bold tracking-tight">
              Thành viên & Phân quyền
            </h1>
            <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              {userData?.total ?? 0} tài khoản
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Quản lý danh sách tài khoản hệ thống và phân quyền vai trò Quản trị
            viên (ADMIN), Cán bộ (OFFICER) và Người dân (CITIZEN).
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col justify-between gap-4 pb-4 md:flex-row md:items-center">
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <Users className="h-4 w-4 text-emerald-500" />
            Danh sách tài khoản ({userData?.total ?? 0})
          </CardTitle>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Tìm email, họ tên..."
                className="h-9 w-[200px] pl-8 sm:w-[240px]"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setUserPage(1);
                }}
              />
            </div>

            <div className="flex items-center gap-1 rounded-md bg-muted p-1 text-xs">
              <Filter className="ml-1 h-3 w-3 text-muted-foreground" />
              {(["ALL", "ADMIN", "OFFICER", "CITIZEN"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setRoleFilter(r);
                    setUserPage(1);
                  }}
                  className={`rounded px-2.5 py-1 transition-colors ${
                    roleFilter === r
                      ? "bg-background font-semibold text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r === "ALL" ? "Tất cả" : r}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isUsersLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner
                size="md"
                label="Đang tải danh sách người dùng..."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                    <th className="px-4 py-3 font-semibold">Thành viên</th>
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">
                      Vai trò hiện tại
                    </th>
                    <th className="px-4 py-3 font-semibold">Trạng thái</th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Thao tác phân quyền
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {!userData?.items || userData.items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-8 text-center text-muted-foreground"
                      >
                        Không tìm thấy người dùng phù hợp.
                      </td>
                    </tr>
                  ) : (
                    userData.items.map((user: User) => (
                      <tr
                        key={user._id}
                        className="border-b transition-colors last:border-0 hover:bg-muted/30"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">
                            {user.fullName || "Chưa đặt tên"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {user.phone || "Không có SĐT"}
                          </div>
                        </td>

                        <td className="px-4 py-3 font-mono text-xs">
                          {user.email}
                        </td>

                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={
                              user.role === "ADMIN"
                                ? "border-purple-500 bg-purple-500/10 font-bold text-purple-600 dark:text-purple-400"
                                : user.role === "OFFICER"
                                  ? "border-blue-500 bg-blue-500/10 font-bold text-blue-600 dark:text-blue-400"
                                  : "border-slate-400 bg-slate-500/10 text-slate-600 dark:text-slate-400"
                            }
                          >
                            {user.role}
                          </Badge>
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                              user.isActive
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                user.isActive ? "bg-emerald-500" : "bg-rose-500"
                              }`}
                            />
                            {user.isActive ? "Hoạt động" : "Bị khóa"}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                disabled={
                                  updateRoleMutation.isPending ||
                                  toggleStatusMutation.isPending
                                }
                                aria-label={`Thiết lập quyền cho ${user.fullName || user.email}`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuLabel className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                                Đổi vai trò hệ thống
                              </DropdownMenuLabel>
                              <DropdownMenuItem
                                disabled={user.role === "OFFICER"}
                                onSelect={() =>
                                  void handleRoleChange(user._id, "OFFICER")
                                }
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${
                                    user.role === "OFFICER"
                                      ? "opacity-100"
                                      : "opacity-0"
                                  }`}
                                />
                                Chuyển thành Cán bộ (OFFICER)
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={user.role === "CITIZEN"}
                                onSelect={() =>
                                  void handleRoleChange(user._id, "CITIZEN")
                                }
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${
                                    user.role === "CITIZEN"
                                      ? "opacity-100"
                                      : "opacity-0"
                                  }`}
                                />
                                Chuyển thành Người dân (CITIZEN)
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={user.role === "ADMIN"}
                                onSelect={() =>
                                  void handleRoleChange(user._id, "ADMIN")
                                }
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${
                                    user.role === "ADMIN"
                                      ? "opacity-100"
                                      : "opacity-0"
                                  }`}
                                />
                                Chuyển thành Quản trị (ADMIN)
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className={
                                  user.isActive
                                    ? "text-rose-600 focus:text-rose-600"
                                    : "text-emerald-600 focus:text-emerald-600"
                                }
                                onSelect={() =>
                                  void handleStatusToggle(
                                    user._id,
                                    user.isActive,
                                  )
                                }
                              >
                                {user.isActive ? (
                                  <>
                                    <Ban className="mr-2 h-4 w-4" />
                                    Khóa tài khoản
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="mr-2 h-4 w-4" />
                                    Mở khóa tài khoản
                                  </>
                                )}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {userData && userData.totalPages > 1 && (
            <div className="flex items-center justify-between border-t p-4 text-xs text-muted-foreground">
              <span>
                Trang {userData.page} / {userData.totalPages} (Tổng cộng{" "}
                {userData.total} tài khoản)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={userPage <= 1}
                  onClick={() => setUserPage((prev) => Math.max(1, prev - 1))}
                >
                  Trước
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={userPage >= userData.totalPages}
                  onClick={() => setUserPage((prev) => prev + 1)}
                >
                  Sau
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
