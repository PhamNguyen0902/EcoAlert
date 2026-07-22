import { useState } from "react";
import { useUpdateAlert } from "@/hooks/hooks";
import { alertService } from "@/services/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, UploadCloud, X } from "lucide-react";
import toast from "react-hot-toast";
import type { Alert } from "@/types";

interface EditReportModalProps {
  alert: Alert;
  isOpen: boolean;
  onClose: () => void;
}

export default function EditReportModal({ alert, isOpen, onClose }: EditReportModalProps) {
  const updateAlertMutation = useUpdateAlert();
  const [title, setTitle] = useState(alert.title);
  const [description, setDescription] = useState(alert.description);
  const [address, setAddress] = useState(alert.address || "");
  const [mediaUrls, setMediaUrls] = useState<string[]>(alert.mediaUrls || []);
  const [isUploading, setIsUploading] = useState(false);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      toast.loading("Uploading image...", { id: "upload" });
      const url = await alertService.uploadMedia(file);
      setMediaUrls((prev) => [...prev, url]);
      toast.success("Image uploaded successfully!", { id: "upload" });
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to upload image", { id: "upload" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    setMediaUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title || title.length < 5) {
      toast.error("Tiêu đề phải từ 5 ký tự trở lên");
      return;
    }
    if (!description || description.length < 10) {
      toast.error("Mô tả phải từ 10 ký tự trở lên");
      return;
    }

    updateAlertMutation.mutate(
      {
        id: alert._id,
        data: {
          title,
          description,
          address,
          mediaUrls,
        },
      },
      {
        onSuccess: () => {
          toast.success("Cập nhật báo cáo thành công!");
          onClose();
        },
        onError: (err: any) => {
          const apiError = err.response?.data;
          let msg = "Cập nhật báo cáo thất bại";
          if (typeof apiError === 'object' && apiError?.errors?.length) {
            msg = apiError.errors.join(', ');
          } else if (typeof apiError === 'object' && apiError?.message) {
            msg = apiError.message;
          } else if (err.response?.status === 404) {
            msg = "Backend alert-service chưa được khởi động lại để nhận route mới (Lỗi 404). Vui lòng restart alert-service!";
          } else if (err?.message) {
            msg = err.message;
          }
          toast.error(msg);
        },
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-xl shadow-xl max-w-lg w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto relative animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between border-b pb-4">
          <h3 className="text-xl font-bold">Chỉnh sửa báo cáo sự cố</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Tiêu đề báo cáo</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Tiêu đề sự cố..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Địa chỉ / Vị trí</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Địa chỉ sự cố..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Mô tả chi tiết</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả sự cố..."
              className="h-28"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Hình ảnh minh chứng</Label>
            <div className="grid grid-cols-3 gap-2">
              {mediaUrls.map((url, idx) => (
                <div key={idx} className="relative rounded-lg overflow-hidden border h-20 group">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(idx)}
                    className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-90 hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <label className="flex flex-col items-center justify-center h-20 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <UploadCloud className="h-5 w-5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground mt-1">Thêm ảnh</span>
                <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={isUploading} />
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={updateAlertMutation.isPending || isUploading}>
              {updateAlertMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Lưu thay đổi
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
