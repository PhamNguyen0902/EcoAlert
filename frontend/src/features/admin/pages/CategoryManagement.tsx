import { useState } from 'react';
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from '@/hooks/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Edit2, Trash2, Tag, Search } from 'lucide-react';
import { Category } from '@/types';
import toast from 'react-hot-toast';

export default function CategoryManagement() {
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('AlertTriangle');
  const [defaultSeverity, setDefaultSeverity] = useState<string>('medium');

  const { data: categories, isLoading } = useCategories(true);
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const handleOpenCreate = () => {
    setEditingCategory(null);
    setName('');
    setCode('');
    setDescription('');
    setIcon('AlertTriangle');
    setDefaultSeverity('medium');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cat: Category) => {
    setEditingCategory(cat);
    setName(cat.name);
    setCode(cat.code);
    setDescription(cat.description || '');
    setIcon(cat.icon || 'AlertTriangle');
    setDefaultSeverity(cat.defaultSeverity || 'medium');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Vui lòng nhập tên danh mục');
      return;
    }

    try {
      if (editingCategory) {
        await updateCategory.mutateAsync({
          id: editingCategory._id,
          data: { name, code, description, icon, defaultSeverity: defaultSeverity as any },
        });
        toast.success('Cập nhật danh mục thành công');
      } else {
        await createCategory.mutateAsync({
          name,
          code,
          description,
          icon,
          defaultSeverity: defaultSeverity as any,
          isActive: true,
        });
        toast.success('Tạo danh mục mới thành công');
      }
      setIsModalOpen(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra');
    }
  };

  const handleToggleActive = async (cat: Category) => {
    try {
      await updateCategory.mutateAsync({
        id: cat._id,
        data: { isActive: !cat.isActive },
      });
      toast.success(`Đã ${!cat.isActive ? 'kích hoạt' : 'ẩn'} danh mục`);
    } catch {
      toast.error('Có lỗi xảy ra khi thay đổi trạng thái');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa danh mục này?')) {
      try {
        await deleteCategory.mutateAsync(id);
        toast.success('Đã xóa danh mục');
      } catch {
        toast.error('Không thể xóa danh mục này');
      }
    }
  };

  if (isLoading) return <LoadingSpinner />;

  const filteredCategories = (categories || []).filter((c: Category) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Quản lý Danh mục Sự cố</h2>
        <Button onClick={handleOpenCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Thêm danh mục mới
        </Button>
      </div>

      {/* Modal Create/Edit */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Chỉnh sửa Danh mục' : 'Thêm mới Danh mục Sự cố'}
            </DialogTitle>
            <DialogDescription>
              Thiết lập các loại sự cố môi trường để người dân và cán bộ dễ dàng phân loại.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Tên danh mục *</label>
              <Input
                placeholder="Ví dụ: Ô nhiễm nguồn nước"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!editingCategory) {
                    setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '_'));
                  }
                }}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Mã Code *</label>
              <Input
                placeholder="WATER_POLLUTION"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Mô tả</label>
              <Input
                placeholder="Mô tả chi tiết loại sự cố..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Mức độ mặc định</label>
              <Select value={defaultSeverity} onValueChange={setDefaultSeverity}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn mức độ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Thấp (Low)</SelectItem>
                  <SelectItem value="medium">Trung bình (Medium)</SelectItem>
                  <SelectItem value="high">Cao (High)</SelectItem>
                  <SelectItem value="critical">Nghiêm trọng (Critical)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={createCategory.isPending || updateCategory.isPending}>
                {editingCategory ? 'Lưu thay đổi' : 'Tạo mới'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" /> Danh sách Danh mục Sự cố ({filteredCategories.length})
          </CardTitle>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Tìm danh mục..."
              className="w-[250px] pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="p-4 font-medium">Tên Danh mục</th>
                  <th className="p-4 font-medium">Mã Code</th>
                  <th className="p-4 font-medium">Mức độ mặc định</th>
                  <th className="p-4 font-medium">Mô tả</th>
                  <th className="p-4 font-medium">Trạng thái</th>
                  <th className="p-4 font-medium text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.map((cat: Category) => (
                  <tr key={cat._id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="p-4 font-semibold">{cat.name}</td>
                    <td className="p-4 font-mono text-xs text-muted-foreground">{cat.code}</td>
                    <td className="p-4">
                      <Badge variant="outline" className={
                        cat.defaultSeverity === 'critical' || cat.defaultSeverity === 'high' ? 'border-red-500 text-red-500' :
                        cat.defaultSeverity === 'medium' ? 'border-amber-500 text-amber-500' : 'border-blue-500 text-blue-500'
                      }>
                        {cat.defaultSeverity?.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="p-4 text-muted-foreground max-w-xs truncate">
                      {cat.description || '-'}
                    </td>
                    <td className="p-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(cat)}
                      >
                        <Badge variant={cat.isActive ? 'default' : 'secondary'}>
                          {cat.isActive ? 'Đang sử dụng' : 'Đã ẩn'}
                        </Badge>
                      </Button>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(cat)}
                          title="Chỉnh sửa"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500"
                          onClick={() => handleDelete(cat._id)}
                          title="Xóa"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredCategories.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-muted-foreground">
                      Chưa có danh mục nào phù hợp
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
